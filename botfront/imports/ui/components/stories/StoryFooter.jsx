import React from 'react';
import PropTypes from 'prop-types';
import {
    Segment,
    Breadcrumb,
    Icon,
    Menu,
    Dropdown,
    Checkbox,
} from 'semantic-ui-react';
import { connect } from 'react-redux';
import StoryPathPopup from './StoryPathPopup.jsx';
import { ConversationOptionsContext } from './Context';
import { can } from '../../../lib/scopes';

class StoryFooter extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }

    renderPath = () => {
        const { storyPath } = this.props;
        let pathBreadcrumbs = [];
        // we create that shallow copy, because we may need to modify it if it is too long
        let computedStoryPath = [...storyPath];
        const maxLength = 5;

        if (storyPath.length > maxLength) {
            computedStoryPath = storyPath.slice(storyPath.length - maxLength, storyPath.length);
            pathBreadcrumbs = [
                ...pathBreadcrumbs,
                <StoryPathPopup
                    key='ellipsis'
                    storyPath={storyPath.join('>')}
                    trigger={(
                        <Breadcrumb.Section className='collapsed-path'>
                            <Icon disabled color='grey' name='ellipsis horizontal' size='small' />
                        </Breadcrumb.Section>
                    )}
                />,
                <Breadcrumb.Divider key='ellipsis-divider'>{' > '}</Breadcrumb.Divider>,
            ];
        }
        computedStoryPath.forEach((location, index) => {
            pathBreadcrumbs = [
                ...pathBreadcrumbs,
                <Breadcrumb.Section key={`popup-location-${index}`}>{location}</Breadcrumb.Section>,
                <Breadcrumb.Divider key={`popup-divider-${index}`}>{'>'}</Breadcrumb.Divider>,
            ];
        });
        // remove the latest divider, as we don't want to display it
        pathBreadcrumbs.pop();
        return pathBreadcrumbs;
    };

    handleBranchClick = () => {
        const { onBranch, canBranch } = this.props;
        if (canBranch) {
            onBranch();
        }
    };

    handlerContinueClick = () => {
        const { onContinue } = this.props;
        onContinue();
    };

    selectIconColor = (active) => {
        if (active) {
            return 'blue';
        }
        return 'grey';
    }

    selectMenuClass = () => {
        const { canContinue } = this.props;
        if (canContinue) {
            return '';
        }
        return ' linked';
    }

    filterDestinations = (data, _id) => data.filter((story) => {
        if (story._id === _id) {
            if (story.branches && story.branches.length > 0 && !(story.rules && story.rules.length > 0)) return true;
            return false;
        }
        if (story.smart) return false;
        if (story.rules && story.rules.length > 0) return false;
        return true;
    }).map(({ value, text }) => ({ value, text }));


    renderContinue = () => {
        const { canContinue, disableContinue } = this.props;
        if (disableContinue) {
            return <></>;
        }
        if (canContinue) {
            return (
                <Menu.Item className='footer-option-button' onClick={this.handlerContinueClick}>
                    <Icon name='arrow alternate circle right outline' color='blue' />
                    Connect
                </Menu.Item>
            );
        }
        return (
            <Menu.Item className='footer-option-button' onClick={this.handlerContinueClick}>
                <Icon className='long' name='arrow alternate circle right outline' color='blue' />
                Continue To Linked Story
            </Menu.Item>
        );
    }

    renderBranchMenu = () => {
        const {
            canBranch,
            fragment,
            destinationStory,
        } = this.props;
        if (destinationStory || fragment.type === 'rule') return null;
        return (
            <Menu.Item
                onClick={this.handleBranchClick}
                className={`footer-option-button color-${this.selectIconColor(
                    canBranch,
                )}`}
                data-cy='create-branch'
            >
                <Icon
                    disabled={!canBranch}
                    name='code branch'
                    color={this.selectIconColor(canBranch)}
                />
                Branch Story
            </Menu.Item>
        );
    }

    renderWaitForUserInputToggle = () => {
        const { fragment, projectId } = this.props;
        const { updateStory } = this.context;
        const { _id, type, wait_for_user_input: waitInput = true } = fragment;
        if (type !== 'rule') return null;
        return (
            <Menu.Item position='right'>
                <Checkbox
                    disabled={!can('stories:w', projectId)}
                    toggle
                    label='wait for user input'
                    className='story-box-toggle'
                    checked={waitInput}
                    onChange={() => updateStory({ _id, wait_for_user_input: !waitInput })}
                />
            </Menu.Item>
        );
    }

    renderLinkMenu = () => {
        const {
            canBranch,
            fragment,
            destinationStory,
            onDestinationStorySelection,
        } = this.props;
        const { stories } = this.context;
        if (!canBranch || fragment.type === 'rule') return null;
        return (
            <Menu.Item
                className={`footer-option-button remove-padding color-${this.selectIconColor(
                    canBranch,
                )}`}
                data-cy='link-to'
                position={this.positionStoryLinker(destinationStory)}
            >
                <Icon
                    disabled={!canBranch}
                    name='arrow right'
                    color='green'
                />
                Link&nbsp;to:
                <Dropdown
                    placeholder='Select story'
                    value={destinationStory ? destinationStory._id : ''}
                    fluid
                    search
                    selection
                    clearable
                    selectOnBlur={false}
                    className='stories-linker'
                    options={this.filterDestinations(stories, fragment._id)}
                    data-cy='stories-linker'
                    disabled={!canBranch}
                    onChange={onDestinationStorySelection}
                />
            </Menu.Item>
        );
    };

    positionStoryLinker = destinationStory => (destinationStory === null ? 'right' : 'left');

    static contextType = ConversationOptionsContext;

    render() {
        const { destinationStory, fragment: { type } = {}, projectId } = this.props;
        return (
            <Segment data-cy='story-footer' className={`footer-segment ${destinationStory === null ? '' : 'linked'}`} size='mini' attached='bottom'>
                <div className='breadcrumb-container'>{this.renderPath()}</div>

                <Menu fluid size='mini' borderless>
                    {type !== 'test_case' && (
                        <>
                            {can('stories:w', projectId) && this.renderBranchMenu()}
                            {can('stories:w', projectId) && this.renderLinkMenu()}
                            {this.renderContinue()}
                            {this.renderWaitForUserInputToggle()}
                        </>
                    )}
                </Menu>

            </Segment>
        );
    }
}

StoryFooter.propTypes = {
    storyPath: PropTypes.array,
    canBranch: PropTypes.bool,
    fragment: PropTypes.object.isRequired,
    canContinue: PropTypes.bool,
    onBranch: PropTypes.func.isRequired,
    onContinue: PropTypes.func.isRequired,
    onDestinationStorySelection: PropTypes.func.isRequired,
    disableContinue: PropTypes.bool,
    destinationStory: PropTypes.object,
    projectId: PropTypes.string.isRequired,
};

StoryFooter.defaultProps = {
    storyPath: [],
    canBranch: true,
    canContinue: true,
    disableContinue: true,
    destinationStory: null,
};

const mapStateToProps = state => ({
    projectId: state.settings.get('projectId'),
});

export default connect(mapStateToProps)(StoryFooter);
