import React, {
    useState, useEffect, useMemo, useRef, useContext,
} from 'react';
import PropTypes from 'prop-types';
import { debounce } from 'lodash';
import {
    Message, Button, Icon, Confirm,
} from 'semantic-ui-react';
import IntentLabel from '../common/IntentLabel';
import UserUtteranceViewer from '../common/UserUtteranceViewer';
import { useActivity, useDeleteActivity, useUpsertActivity } from './hooks';

import { populateActivity } from './ActivityInsertions';
import { getSmartTips } from '../../../../lib/smart_tips';
import Filters from '../models/Filters';

import DataTable from '../../common/DataTable';
import ActivityActionsColumn from './ActivityActionsColumn';
import { clearTypenameField } from '../../../../lib/client.safe.utils';
import { cleanDucklingFromExamples } from '../../../../lib/utils';
import { isTraining } from '../../../../api/nlu_model/nlu_model.utils';
import { can, Can } from '../../../../lib/scopes';
import { useEventListener } from '../../utils/hooks';
import { useInsertExamples } from '../models/hooks';
import { ProjectContext } from '../../../layouts/context';

import PrefixDropdown from '../../common/PrefixDropdown';
import ActivityCommandBar from './ActivityCommandBar';
import CanonicalPopup from '../common/CanonicalPopup';
import ConversationSidePanel from './ConversationSidePanel';
import ConversationIcon from './ConversationIcon';

function Activity(props) {
    const [sortType, setSortType] = useState('Newest');
    const {
        intents,
        entities,
    } = useContext(ProjectContext);
    const getSortFunction = () => {
        switch (sortType) {
        case 'Newest':
            return { sortKey: 'createdAt', sortDesc: true };
        case 'Oldest':
            return { sortKey: 'createdAt', sortDesc: false };
        case 'Validated first':
            return { sortKey: 'validated', sortDesc: true };
        case 'Validated last':
            return { sortKey: 'validated', sortDesc: false };
        case '% ascending':
            return { sortKey: 'confidence', sortDesc: false };
        case '% decending':
            return { sortKey: 'confidence', sortDesc: true };
        default:
            throw new Error('No such sort type');
        }
    };

    const { linkRender } = props;
    const {
        language,
        environment,
        project,
        project: { training: { endTime } = {}, _id: projectId, nluThreshold },
        instance,
    } = useContext(ProjectContext);
    const examples = []; // change me!!!!

    const [openConvPopup, setOpenConvPopup] = useState(false);
    const [filter, setFilter] = useState({
        entities: [], intents: [], query: '', dateRange: {},
    });

    const variables = useMemo(() => ({
        projectId,
        language,
        env: environment,
        pageSize: 20,
        filter,
        ...getSortFunction(),
    }), [projectId, language, environment, filter, getSortFunction()]);

    const {
        data, hasNextPage, loading, loadMore, refetch,
    } = useActivity(variables);
    const [insertExamples] = useInsertExamples(variables, false);
    const [selection, setSelection] = useState([]);
    let reinterpreting = [];
    const setReinterpreting = (v) => {
        reinterpreting = v;
    };
    const [confirm, setConfirm] = useState(null);
    const singleSelectedIntentLabelRef = useRef();
    const activityCommandBarRef = useRef();
    const tableRef = useRef();
    const canEdit = useMemo(() => can('incoming:w', projectId), [projectId]);
    
    // always refetch on first page load and sortType change
    useEffect(() => {
        if (refetch) refetch();
    }, [refetch, projectId, language, sortType, filter]);

    const [upsertActivity] = useUpsertActivity(variables);
    const [deleteActivity] = useDeleteActivity(variables);

    const isUtteranceOutdated = utterance => getSmartTips({
        nluThreshold, endTime, examples, utterance,
    }).code === 'outdated';
    const isUtteranceReinterpreting = ({ _id }) => reinterpreting.includes(_id);

    const validated = data.filter(a => a.validated);

    const getFallbackUtterance = (ids) => {
        const bounds = [ids[0], ids[ids.length - 1]].map(id1 => data.findIndex(d => d._id === id1));
        return data[bounds[1] + 1]
            ? data[bounds[1] + 1]
            : data[Math.max(0, bounds[0] - 1)];
    };

    const mutationCallback = (fallbackUtterance, mutationName) => ({
        data: { [mutationName]: res = [] } = {},
    }) => {
        const filtered = selection.filter(s => !res.map(({ _id }) => _id).includes(s));
        return setSelection(
            // remove deleted from selection
            filtered.length ? filtered : [fallbackUtterance._id],
        );
    };

    const handleAddToTraining = async (utterances) => {
        const fallbackUtterance = getFallbackUtterance(utterances.map(u => u._id));
        const toAdd = cleanDucklingFromExamples(clearTypenameField(
            utterances.map(({ text, intent, entities: ents }) => ({ text, intent, entities: ents })),
        ));
        insertExamples({ variables: { examples: toAdd } });
        const result = await deleteActivity({
            variables: { ids: utterances.map(u => u._id) },
        });
        mutationCallback(fallbackUtterance, 'deleteActivity')(result);
    };

    const handleUpdate = async (newData) => {
        const possiblyValidated = newData.filter(utterance => utterance.validated !== false).map(utterance => utterance._id);
        const dataUpdated = clearTypenameField(
            data
                .filter(d1 => newData.map(d2 => d2._id).includes(d1._id))
                .map(d1 => ({ ...d1, ...newData.find(d2 => d2._id === d1._id) })),
        );
        
        const toInsert = dataUpdated.map((utterance) => {
            if (possiblyValidated.includes(utterance._id) && utterance.intent && utterance.validated !== undefined) return { ...utterance, validated: true };
            return utterance;
        });
       
        return upsertActivity({
            variables: { data: toInsert },
            optimisticResponse: {
                __typename: 'Mutation',
                upsertActivity: toInsert.map(d => ({
                    __typename: 'Activity',
                    ...d,
                })),
            },
        });
    };

    const handleDelete = (utterances) => {
        const ids = utterances.map(u => u._id);
        const fallbackUtterance = getFallbackUtterance(ids);
        const message = `Delete ${utterances.length} incoming utterances?`;
        const action = () => deleteActivity({
            variables: { ids },
            optimisticResponse: {
                __typename: 'Mutation',
                deleteActivity: ids.map(_id => ({ __typename: 'Activity', _id })),
            },
        }).then(mutationCallback(fallbackUtterance, 'deleteActivity'));
        return utterances.length > 1 ? setConfirm({ message, action }) : action();
    };

    const handleSetValidated = (utterances, val = true) => {
        const message = `Mark ${utterances.length} incoming utterances as ${
            val ? 'validated' : 'invalidated'
        } ?`;
        const action = () => handleUpdate(utterances.map(({ _id }) => ({ _id, validated: val })));
        return utterances.length > 1 ? setConfirm({ message, action }) : action();
    };

    const handleMarkOoS = (utterances, ooS = true) => {
        const fallbackUtterance = getFallbackUtterance(utterances.map(u => u._id));
        const message = `Mark ${utterances.length} incoming utterances as out of scope?`;
        const action = () => handleUpdate(utterances.map(({ _id }) => ({ _id, ooS })))
            .then(mutationCallback(fallbackUtterance, 'upsertActivity'));
        return utterances.length > 1 ? setConfirm({ message, action }) : action();
    };

    const handleSetIntent = (utterances, intent) => {
        const message = intent
            ? `Set intent of ${utterances.length} incoming utterances to ${intent}?`
            : `Reset intent of ${utterances.length} incoming utterances?`;
        const action = () => handleUpdate(
            utterances.map(({ _id }) => ({
                _id,
                intent,
                confidence: null,
                ...(!intent ? { validated: false } : {}),
            })),
        );
        return utterances.length > 1 ? setConfirm({ message, action }) : action();
    };

    const handleReinterpret = async (utterances) => {
        setReinterpreting(
            Array.from(new Set([...reinterpreting, ...utterances.map(u => u._id)])),
        );
        const reset = () => setReinterpreting(
            reinterpreting.filter(
                uid => !utterances.map(u => u._id).includes(uid),
            ),
        );
        try {
            populateActivity(
                instance,
                utterances.map(u => ({ text: u.text, lang: language })),
                projectId,
                language,
                reset,
            );
        } catch (e) {
            reset();
        }
    };

    const doAttemptReinterpretation = (visibleData) => {
        if (isTraining(project)) return;
        if (reinterpreting.length > 49) return;
        const reinterpretable = visibleData
            .filter(isUtteranceOutdated)
            .filter(u => !isUtteranceReinterpreting(u));
        if (reinterpretable.length) handleReinterpret(reinterpretable);
    };

    const handleScroll = debounce((items) => {
        const { visibleStartIndex: start, visibleStopIndex: end } = items;
        const visibleData = Array(end - start + 1)
            .fill()
            .map((_, i) => start + i)
            .map(i => data[i])
            .filter(d => d);
        doAttemptReinterpretation(visibleData);
    }, 500);

    const renderConfidence = (row) => {
        const { datum } = row;
        if (
            isUtteranceOutdated(datum)
            || typeof datum.intent !== 'string'
            || typeof datum.confidence !== 'number'
            || datum.confidence <= 0
        ) { return null; }
        return (
            <div className='confidence-text'>
                {`${Math.floor(datum.confidence * 100)}%`}
            </div>
        );
    };

    const renderIntent = (row) => {
        const { datum } = row;
        return (
            <CanonicalPopup
                // when CanonicalPopup is present ref to IntentLabel goes via it
                {...(selection.length === 1 && datum._id === selection[0] ? { ref: singleSelectedIntentLabelRef } : {})}
                example={datum}
                trigger={(
                    <IntentLabel
                        disabled={isUtteranceOutdated(datum)}
                        value={datum.intent ? datum.intent : ''}
                        allowEditing={canEdit && !isUtteranceOutdated(datum)}
                        allowAdditions
                        onChange={intent => handleSetIntent([{ _id: datum._id }], intent)}
                        enableReset
                        onClose={() => tableRef?.current?.focusTable()}
                    />
                )}
            />
        );
    };

    const renderExample = (row) => {
        const { datum } = row;
        return (
            <UserUtteranceViewer
                value={datum}
                onChange={({ _id, entities: ents }) => handleUpdate([{ _id, entities: ents }])}
                projectId={projectId}
                disabled={isUtteranceOutdated(datum)}
                disableEditing={isUtteranceOutdated(datum) || !canEdit}
                showIntent={false}
            />
        );
    };

    const renderActions = row => (
        <ActivityActionsColumn
            outdated={isUtteranceOutdated(row.datum)}
            datum={row.datum}
            handleSetValidated={handleSetValidated}
            onDelete={handleDelete}
            onMarkOoS={handleMarkOoS}
            data={data}
            getSmartTips={utterance => getSmartTips({
                nluThreshold, endTime, examples, utterance,
            })}
        />
    );

    const renderConvPopup = row => (
        <ConversationIcon
            {...row}
            open={(row.datum || {})._id === openConvPopup._id}
            setOpen={(open) => {
                setOpenConvPopup(!!open ? row.datum : false);
            }}
        />
    );
        
    const columns = [
        { key: '_id', selectionKey: true, hidden: true },
        {
            key: 'confidence',
            style: { width: '51px', minWidth: '51px' },
            render: renderConfidence,
        },
        {
            key: 'intent',
            style: { width: '180px', minWidth: '180px', overflow: 'hidden' },
            render: renderIntent,
        },
        {
            key: 'conversation-popup', style: { width: '30px', minWidth: '30px' }, render: renderConvPopup,
        },
        {
            key: 'text',
            style: { width: '100%' },
            render: renderExample,
        },
        ...(can('incoming:w', projectId) ? [
            {
                key: 'actions',
                style: { width: '110px' },
                render: renderActions,
            },
        ] : []),
    ];

    const handleOpenIntentSetterDialogue = () => {
        if (!selection.length) return null;
        if (selection.length === 1) { return singleSelectedIntentLabelRef.current.openPopup(); }
        return activityCommandBarRef.current.openIntentPopup();
    };

    const selectionWithFullData = useMemo(
        () => data.filter(({ _id }) => selection.includes(_id)),
        [selection, data],
    );

    useEventListener('keydown', (e) => {
        const {
            key, shiftKey, metaKey, ctrlKey, altKey,
        } = e;
        if (shiftKey || metaKey || ctrlKey || altKey) return;
        if (!!confirm) {
            if (key.toLowerCase() === 'n') setConfirm(null);
            if (key.toLowerCase() === 'y' || key === 'Enter') {
                confirm.action();
                setConfirm(null);
            }
            return;
        }
        if (e.target !== tableRef?.current?.actualTable()) return;
        if (key === 'Escape') setSelection([]);
        if (key.toLowerCase() === 'd') handleDelete(selectionWithFullData);
        if (key.toLowerCase() === 'o') handleMarkOoS(selectionWithFullData);
        if (key.toLowerCase() === 'c') {
            if (openConvPopup._id === selection[0]) setOpenConvPopup(false);
            else setOpenConvPopup(data.find(datum => datum._id === selection[0]) || false);
        }
        if (key.toLowerCase() === 'v') {
            if (selectionWithFullData.some(d => !d.intent || isUtteranceOutdated(d))) return;
            handleSetValidated(
                selectionWithFullData,
                selectionWithFullData.some(d => !d.validated),
            );
        }
        if (key.toLowerCase() === 'i') {
            e.preventDefault();
            handleOpenIntentSetterDialogue(e);
        }
    });

    const renderTopBar = () => (
        <div className='side-by-side wrap' style={{ marginBottom: '10px' }}>
            {!!confirm && (
                <Confirm
                    open
                    className='with-shortcuts'
                    cancelButton='No'
                    confirmButton='Yes'
                    content={confirm.message}
                    onCancel={() => {
                        setConfirm(null);
                        return tableRef?.current?.focusTable();
                    }}
                    onConfirm={() => {
                        confirm.action();
                        setConfirm(null);
                        return tableRef?.current?.focusTable();
                    }}
                />
            )}
            <Can I='nlu-data:w'>
                <Button.Group>
                    <Button
                        className='white'
                        basic
                        color='green'
                        icon
                        labelPosition='left'
                        data-cy='run-evaluation'
                        onClick={() => setConfirm({
                            message:
                                'This will evaluate the model using the validated examples as a validation set and overwrite your current evaluation results.',
                            action: linkRender,
                        })
                        }
                        disabled={!validated.length}
                    >
                        <Icon name='lab' />
                        Run evaluation
                    </Button>
                    <Button
                        color='green'
                        icon
                        labelPosition='right'
                        data-cy='add-to-training-data'
                        onClick={() => setConfirm({
                            message:
                                'The validated utterances will be added to the training data.',
                            action: () => handleAddToTraining(validated),
                        })
                        }
                        disabled={!validated.length}
                    >
                        <Icon name='add square' />
                        Add to training data
                    </Button>
                </Button.Group>
            </Can>
            <PrefixDropdown
                selection={sortType}
                updateSelection={option => setSortType(option.value)}
                options={[
                    { value: 'Newest', text: 'Newest' },
                    { value: 'Oldest', text: 'Oldest' },
                    { value: 'Validated first', text: 'Validated first' },
                    { value: 'Validated last', text: 'Validated last' },
                    { value: '% ascending', text: '% ascending' },
                    { value: '% decending', text: '% decending' },
                ]}
                prefix='Sort by'
            />
            <Filters
                intents={intents}
                entities={entities}
                filter={filter}
                onChange={f => setFilter(f)}
                className='left wrap'
            />
        </div>
    );

    return (
        <>
            {!!openConvPopup && <ConversationSidePanel utterance={openConvPopup} onClose={() => setOpenConvPopup(false)} />}
            {renderTopBar()}
            {data && data.length ? (
                <>
                    <DataTable
                        ref={tableRef}
                        columns={columns}
                        data={data}
                        hasNextPage={hasNextPage}
                        loadMore={loading ? () => {} : loadMore}
                        onScroll={handleScroll}
                        selection={selection}
                        onChangeSelection={(newSelection) => {
                            setSelection(newSelection);
                            setOpenConvPopup(false);
                        }}
                    />
                    {can('incoming:w', projectId) && selection.length > 1 && (
                        <ActivityCommandBar
                            ref={activityCommandBarRef}
                            isUtteranceOutdated={isUtteranceOutdated}
                            selection={selectionWithFullData}
                            onSetValidated={handleSetValidated}
                            onDelete={handleDelete}
                            onSetIntent={handleSetIntent}
                            onMarkOoS={handleMarkOoS}
                            onCloseIntentPopup={() => tableRef?.current?.focusTable()}
                        />
                    )}
                </>
            ) : (
                <Message
                    success
                    icon='check'
                    header='No activity'
                    data-cy='no-activity'
                    content='No activity was found for the given criteria.'
                />
            )}
        </>
    );
}

Activity.propTypes = {
    linkRender: PropTypes.func.isRequired,
};

Activity.defaultProps = {};

export default Activity;
