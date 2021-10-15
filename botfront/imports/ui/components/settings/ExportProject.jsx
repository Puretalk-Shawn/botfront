import React, { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import { saveAs } from 'file-saver';
import {
    Dropdown, Button, Message, Icon, Checkbox,
} from 'semantic-ui-react';
import JSZIP from 'jszip';
import { ProjectContext } from '../../layouts/context';

const ExportProject = ({
    setLoading,
}) => {
    const { projectLanguages, language, project: { _id: projectId, name: projectName } } = useContext(ProjectContext);

    const [exportLanguage, setExportLanguage] = useState(projectLanguages.length > 1 ? 'all' : language);
    const [exportConversations, setExportConversations] = useState(false);
    const [exportIncoming, setExportIncoming] = useState(false);

    const [ExportSuccessful, setExportSuccessful] = useState(undefined);
    const [errorMessage, setErrorMessage] = useState({
        header: 'Export Failed',
        text: 'There was an unexpected error during the export.',
    });

    const getLanguageOptions = () => [
        ...(projectLanguages.length > 1
            ? [{ value: 'all', text: 'All languages' }]
            : []),
        ...projectLanguages,
    ].map(({ value, text }) => ({
        key: value,
        text,
        value,
    }));


    const exportForRasa = () => {
        setLoading(true);
        const noSpaceName = projectName.replace(/ +/g, '_');
        const options = { conversations: exportConversations, incoming: exportIncoming };
        Meteor.call('exportRasa', projectId, exportLanguage, options, (err, rasaDataZip) => {
            if (err) {
                setErrorMessage({ header: 'Export Failed!', text: err.message });
                setExportSuccessful(false);
                setLoading(false);
            } else {
                if (window.Cypress) {
                    setExportSuccessful(true);
                    setLoading(false);
                    return;
                }
                const zip = new JSZIP();
                const date = (new Date()).toISOString();
                zip.loadAsync(rasaDataZip, { base64: true }).then((newZip) => {
                    newZip.generateAsync({ type: 'blob' })
                        .then((blob) => {
                            saveAs(blob, `${noSpaceName}_${date}.zip`);
                        });
                });
              
                setExportSuccessful(true);
                setLoading(false);
            }
        });
    };
    

    if (ExportSuccessful === true) {
        return (
            <Message
                data-cy='export-success-message'
                positive
                icon='check circle'
                header='Your project has been successfully exported'
            />
        );
    }
    if (ExportSuccessful === false) {
        return (
            <Message
                data-cy='export-failure-message'
                error
                icon='times circle'
                header={errorMessage.header}
                content={<>{errorMessage.text}</>}
            />
        );
    }
    return (
        <>
            <>
                <Dropdown
                    data-cy='export-language-dropdown'
                    key='language'
                    className='export-option'
                    options={getLanguageOptions()}
                    placeholder='Select a language'
                    selection
                    value={exportLanguage}
                    onChange={(x, { value }) => {
                        setExportLanguage(value);
                    }}
                />  <br />
                <Checkbox
                    toggle
                    checked={exportConversations}
                    onChange={() => setExportConversations(!exportConversations)}
                    label='Export Conversations'
                    className='export-option'
                    key='exportConversations'
                />
                <br />
                <Checkbox
                    toggle
                    checked={exportIncoming}
                    onChange={() => setExportIncoming(!exportIncoming)}
                    label='Export Incoming utterances'
                    className='export-option'
                    key='exportIncoming'
                />
            </>
            
            <br />

            <Button
                onClick={exportForRasa}
                className='export-option'
                data-cy='export-button'
            >
                <Icon name='download' />
                    Export project for Rasa or Botfront
            </Button>
            
           
        </>
    );
};

ExportProject.propTypes = {
    setLoading: PropTypes.func.isRequired,
};

export default ExportProject;
