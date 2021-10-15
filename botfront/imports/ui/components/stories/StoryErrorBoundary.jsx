import { Message } from 'semantic-ui-react';
import PropTypes from 'prop-types';
import React from 'react';
import CrashReportButton from '../utils/CrashReportButton';

class StoryErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null, reported: false };
    }

    componentDidCatch(...error) {
        this.setState({ error });
    }

    render() {
        const { error, reported } = this.state;
        if (error) {
            return (
                <div className='story-error-wrapper'>
                    <Message
                        icon='warning'
                        header='Sorry, something went wrong with the story'
                        content={(
                            <>
                                <p>
                                    Please try to refresh the page. If the problem
                                    persists, try editing the story in text mode.
                                </p>
                                <p>
                                    {reported
                                        ? 'We\'re working on it!'
                                        : 'Help the Botfront project by reporting the issue.'}
                                </p>
                                <p>
                                    <CrashReportButton
                                        error={error}
                                        reported={reported}
                                        onLoad={rep => this.setState({ reported: rep })}
                                    />
                                </p>
                            </>
                        )}
                        negative
                    />
                </div>
            );
        }

        const { children } = this.props;
        return children;
    }
}

StoryErrorBoundary.propTypes = {
    children: PropTypes.element.isRequired,
};

export default StoryErrorBoundary;
