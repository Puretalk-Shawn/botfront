import React from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
import { wrapMeteorCallback } from '../utils/Errors';
import LookupTable from './LookupTable';
import InlineSearch from '../utils/InlineSearch';
import MinScoreEdit from './MinScoreEdit';
import { can } from '../../../lib/scopes';

function ModeEdit({ gazette, onEdit }) {
    function onUpdateText(value, callback) {
        onEdit({ ...gazette, mode: value }, callback);
    }

    const data = ['ratio', 'partial_ratio', 'token_sort_ratio', 'token_set_ratio'];

    return (
        <InlineSearch text={gazette.mode} data={data} onUpdateText={onUpdateText} />
    );
}

ModeEdit.propTypes = {
    gazette: PropTypes.object.isRequired,
    onEdit: PropTypes.func.isRequired,
};

class GazetteEditor extends React.Component {
    onItemChanged = (gazette, callback) => {
        const { model } = this.props;
        Meteor.call('nlu.upsertEntityGazette', model._id, gazette, wrapMeteorCallback(callback));
    };

    onItemDeleted = (gazette, callback) => {
        const { model } = this.props;
        Meteor.call('nlu.deleteEntityGazette', model._id, gazette._id, wrapMeteorCallback(callback));
    };

    extraColumns() {
        const { projectId } = this.props;
        return [
            {
                id: 'mode',
                accessor: e => e,
                Header: 'Mode',
                Cell: (props) => {
                    if (can('nlu-data:w', projectId)) {
                        return (
                            <div>
                                <ModeEdit gazette={props.value} onEdit={this.onItemChanged} />
                            </div>
                        );
                    }
                    return <span>{props.value.mode}</span>;
                },
                width: 130,
                filterable: false,
            },
            {
                id: 'min_score',
                accessor: e => e,
                Header: 'Min Score',
                Cell: (props) => {
                    if (can('nlu-data:w', projectId)) {
                        return <MinScoreEdit gazette={props.value} onEdit={this.onItemChanged} />;
                    }
                    return <span>{props.value.min_score}</span>;
                },
                width: 100,
                filterable: false,
            },
        ];
    }

    render() {
        const { projectId, model } = this.props;
        return (
            <LookupTable
                data={model.training_data.fuzzy_gazette}
                keyHeader='Value'
                keyAttribute='value'
                listHeader='Gazette'
                listAttribute='gazette'
                extraColumns={this.extraColumns()}
                onItemChanged={this.onItemChanged}
                onItemDeleted={this.onItemDeleted}
                valuePlaceholder='entity name'
                listPlaceholder='match1, match2, ...'
                projectId={projectId}
            />
        );
    }
}

GazetteEditor.propTypes = {
    model: PropTypes.object.isRequired,
    projectId: PropTypes.string.isRequired,
};

export default withTracker(props => ({
    model: props.model,
}))(GazetteEditor);
