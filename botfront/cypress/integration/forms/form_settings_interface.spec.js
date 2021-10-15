/* global cy */

const catSlot = 'catSlot';

const newFormName = 'Groupo_1_form';
const description = 'this is test text';

const form = {
    _id: 'ab02fae1-6868-48bd-a83e-4c163d966bbd',
    projectId: 'bf',
    groupId: 'test_group_A',
    name: 'Groupo_1_form',
    pinned: false,
    collect_in_botfront: true,
    description: '',
    graph_elements: [{
        id: '1', data: { type: 'start' }, position: { x: 200, y: 200 }, type: 'start', className: 'start-node',
    }, {
        id: 'slot1',
        data: {
            type: 'slot', slotName: 'slot1', filling: [{ type: 'from_text' }], validation: null,
        },
        position: { x: 120, y: 350 },
        type: 'slot',
        className: 'slot-node expanding-node',
    }, {
        id: 'e1-slot1', source: '1', target: 'slot1', animated: true, type: 'condition', arrowHeadType: 'arrowclosed', data: { condition: null },
    }, {
        id: 'oui',
        data: {
            type: 'slot', slotName: 'oui', filling: [{ type: 'from_text' }], validation: null,
        },
        position: { x: 120, y: 500 },
        type: 'slot',
        className: 'slot-node expanding-node',
    }, {
        id: 'eslot1-oui',
        source: 'slot1',
        target: 'oui',
        animated: true,
        type: 'condition',
        arrowHeadType: 'arrowclosed',
        data: {
            condition: {
                id: 'ab9b9aa9-0123-4456-b89a-b174bc858dca',
                type: 'group',
                children1: {
                    'b8bab9a9-cdef-4012-b456-7174bc85bad5': {
                        type: 'rule',
                        properties: {
                            field: 'slot1', operator: 'is_exactly', value: ['oui'], valueSrc: ['value'], valueType: ['custom_text'],
                        },
                    },
                },
                properties: { conjunction: 'AND' },
            },
        },
    }, {
        id: 'non',
        data: {
            type: 'slot', slotName: 'non', filling: [{ type: 'from_text' }], validation: null,
        },
        position: { x: 420, y: 500 },
        type: 'slot',
        className: 'slot-node',
    }, {
        id: 'eslot1-non', source: 'slot1', target: 'non', animated: true, type: 'condition', arrowHeadType: 'arrowclosed', data: { condition: null },
    }],
    isExpanded: null,
};

describe('use the main form editor interface to', () => {
    beforeEach(() => {
        cy.createProject('bf', 'My Project', 'en');
        cy.login();
    });

    afterEach(() => {
        cy.logout();
        cy.deleteProject('bf');
    });

    const changeResponseType = (type) => {
        cy.dataCy('change-response-type').find('.item').contains(type).click({ force: true });
        cy.dataCy('confirm-response-type-change').click();
    };

    it('should edit the form name, description, slots, and collect in botfront status', () => {
        cy.visit('project/bf/dialogue');
        cy.createStoryGroup();
        cy.createFragmentInGroup({ type: 'form' });
        cy.wait(500);
        cy.createFragmentInGroup({ type: 'form' });
        cy.wait(500);
        cy.selectForm(newFormName);
        cy.dataCy('start-node').click();
        cy.dataCy('form-description-field').type(description);
        cy.dataCy('side-questions').click();
        cy.dataCy('form-collection-togglefield').click();
        
        cy.reload();
        cy.selectForm(newFormName);

        cy.dataCy('start-node').click();
        cy.dataCy('form-description-field').find('textarea').should('have.value', description);
        cy.dataCy('side-questions').should('have.class', 'checked');
        cy.dataCy('form-collection-togglefield').find('[data-cy=toggled-true]');

        cy.selectForm('Groupo_form');
        cy.dataCy('start-node').click();
        cy.dataCy('side-questions').should('have.class', 'checked');
    });

    it('should change the response type via the dropdown', () => {
        cy.visit('project/bf/dialogue');
        cy.createCustomStoryGroup('bf', 'test_group_A', 'group A');
        cy.createForm('bf', 'test1_form', form);
        cy.visit('project/bf/dialogue');
        cy.get('.loader').should('not.exist');
        cy.selectForm(newFormName);

        cy.dataCy('slot-node-slot1').click();

        // check quick reply responses
        cy.dataCy('change-response-type').click();
        cy.dataCy('change-response-type').find('.item').contains('quick reply').click();
        cy.dataCy('confirm-response-type-change').click();
        cy.dataCy('bot-response-input').find('textarea').should('exist');
        cy.dataCy('button_title').should('exist');
        cy.dataCy('icon-pin').should('not.have.class', 'light-green');
        // check button responses
        changeResponseType('buttons');
        cy.dataCy('bot-response-input').find('textarea').should('exist');
        cy.dataCy('button_title').should('exist');
        cy.dataCy('icon-pin').should('have.class', 'light-green');
        // check carousel responses
        changeResponseType('carousel');
        cy.dataCy('add-slide').should('exist');
        cy.dataCy('image-container').should('exist');
        // check custom responses
        changeResponseType('custom');
        cy.dataCy('edit-custom-response').click();
        cy.dataCy('custom-response-editor').should('exist');
        cy.escapeModal();
        // check responses
        changeResponseType('text');
        cy.dataCy('edit-custom-response').should('not.exist');
        cy.dataCy('bot-response-input').find('textarea').should('exist');
        // edit response
        cy.dataCy('slot-node-wrapper-slot1').find('[data-cy=bot-response-input]').find('textarea').type('categorical slot')
            .blur();
        cy.reload();
        cy.get('.loader').should('not.exist');
        cy.selectForm(newFormName);
        cy.dataCy('slot-node-wrapper-slot1').find('[data-cy=bot-response-input]').find('textarea').should('have.text', 'categorical slot');
    });

    it('should create, edit and delete a set slot node', () => {
        cy.visit('project/bf/dialogue');
        cy.createStoryGroup();
        cy.createFragmentInGroup({ type: 'form' });
        cy.wait(300);
        cy.createFragmentInGroup({ type: 'form' });
        cy.meteorAddSlot('bool_slot', 'bool');
        cy.meteorAddSlot('text_slot', 'text');
        cy.meteorAddSlot('float_slot', 'float');
        cy.selectForm(newFormName);

        cy.dataCy('start-node').click();
        cy.dataCy('side-questions').click();
        cy.dataCy('form-collection-togglefield').click();
        cy.dataCy('toggled-true').should('exist');

        cy.dataCy('add-node-1').click();
        cy.dataCy('add-node-1').find('[data-cy=set-slot]').click();
        cy.get('.item.dropdown').should('not.include.text', 'float')
        cy.get('.item.dropdown').should('not.include.text', 'text')
        cy.get('.item.dropdown').should('include.text', 'categorical')
        cy.get('.item.dropdown').contains('bool').click();
        cy.get('.item.dropdown').contains('bool_slot').click();
        cy.get('.item.dropdown').contains('true').click();
        cy.get('.label-container.orange').should('contain.text', 'true').click();
        cy.get('.item.dropdown').should('not.include.text', 'float')
        cy.get('.item.dropdown').should('not.include.text', 'text')
        cy.get('.item.dropdown').should('include.text', 'categorical')
        cy.get('.item.dropdown').contains('bool').click();
        cy.get('.item.dropdown').contains('bool_slot').click();
        cy.get('.item.dropdown').contains('false').click();
        cy.get('.label-container.orange').should('contain.text', 'false').click();
        cy.get('.item.dropdown').contains('bool').click();
        cy.get('.item.dropdown').contains('bool_slot').click();
        cy.get('.item.dropdown').contains('null').click();
        cy.get('.label-container.orange').should('contain.text', 'null').click();
        cy.dataCy('slot-set-node').find('[data-cy=icon-trash]').click();
        cy.dataCy('slot-set-node').should('not.exist');
    });

    it('should change the response languages', () => {
        cy.createNLUModelProgramatically('bf', '', 'fr');
        cy.visit('project/bf/dialogue');
        cy.meteorAddSlot('bool_slot', 'bool');
        cy.createStoryGroup();
        cy.createFragmentInGroup({ type: 'form' });
        cy.wait(300);
        cy.createFragmentInGroup({ type: 'form' });
        cy.selectForm(newFormName);
        cy.dataCy('start-node').click();
        cy.dataCy('side-questions').click();
        cy.dataCy('form-collection-togglefield').click();
        cy.dataCy('toggled-true').should('exist');
        cy.addSlotNode('1', 'slot1');
        cy.dataCy('bot-response-input').find('textarea').click();
        cy.dataCy('bot-response-input').find('textarea').type('test').blur();
        cy.dataCy('language-selector').click();
        cy.dataCy('language-selector').find('span.text').contains('French').click();
        cy.get('[data-cy=bot-response-input] > div >textarea').should('not.have.value', 'test');
        cy.dataCy('language-selector').click();
        cy.dataCy('language-selector').find('span.text').contains('English').click();
        cy.get('[data-cy=bot-response-input] > div >textarea').should('have.value', 'test');
    });

    it('set all slot types', () => {
        cy.visit('project/bf/dialogue');
        cy.import('bf', 'nlu_entity_sample.json', 'en');
        cy.meteorAddSlot('catSlot', 'categorical');
        cy.createForm('bf', 'test1_form', {
            slots: [],
        });
        cy.createStoryGroup();
        cy.createFragmentInGroup({ type: 'form' });
        cy.wait(300);
        cy.selectForm('Groupo_form');
        cy.dataCy('add-node-1').click();
        cy.dataCy('add-node-1').find('[data-cy=add-question]').click();
        cy.dataCy('existing-slot').click();
        cy.dataCy('slot-category-categorical').click();
        cy.dataCy('choose-catSlot').click();
        
        
        cy.dataCy('slot-node-wrapper-catSlot').click();
        cy.dataCy('form-top-menu-item').contains('Extraction').click();
        cy.dataCy('extraction-source-dropdown').click();
        cy.dataCy('extraction-source-dropdown').children().find('div.item').last()
            .click();


        cy.dataCy('entity-dropdown').click();
        cy.dataCy('entity-dropdown').find('input').type('shop{enter}');
        cy.dataCy('add-condition').click();
        cy.dataCy('extraction-source-dropdown').should('have.length', 2);
        cy.dataCy('extraction-source-dropdown').last().click();
        cy.dataCy('extraction-source-dropdown').last().find('span').contains('intent')
            .click();
        cy.dataCy('intent-condition-dropdown').last().click();
        cy.dataCy('intent-condition-dropdown').last().find('span').contains('NOT')
            .click();
        // cy.addConversationEventFilter('intent', 'test');
        cy.dataCy('sequence-selector').click();
        cy.dataCy('sequence-selector').find('input').should('exist');
        cy.dataCy('sequence-selector').find('input').click();
        cy.dataCy('sequence-selector').find('input').type('chitchat.greet{enter}');
        cy.dataCy('sequence-selector').click();
        cy.dataCy('sequence-selector').find('input').should('exist');
        cy.dataCy('sequence-selector').find('input').click();
        cy.dataCy('sequence-selector').find('input').type('chitchat.bye{enter}');
        cy.dataCy('category-value-dropdown').last().click();
        cy.dataCy('category-value-dropdown').last().find('span').contains('blue')
            .click();
        cy.dataCy('add-condition').click();
        cy.dataCy('extraction-source-dropdown').should('have.length', 3);
        cy.dataCy('extraction-source-dropdown').last().click();
        cy.dataCy('extraction-source-dropdown').last().find('span').contains('from the user message')
            .click();
        cy.dataCy('extraction-source-dropdown').find('div.text').contains('from the user message');
        cy.reload();
        cy.wait(5000); // wait for story menu to appear
        cy.dataCy('story-group-menu-item').should('exist');
        cy.selectForm('Groupo_form');
        cy.dataCy('slot-node-wrapper-catSlot').click();
        cy.dataCy('form-top-menu-item').contains('Extraction').click();
        cy.dataCy('form-top-menu-item').contains('Extraction').click();
        cy.dataCy('extraction-source-dropdown').should('have.length', 3);
        // sources
        cy.dataCy('extraction-source-dropdown').eq(0).find('div.text').should('have.text', 'from the entity');
        cy.dataCy('extraction-source-dropdown').eq(1).find('div.text').should('have.text', 'conditionally on the intent');
        cy.dataCy('extraction-source-dropdown').eq(2).find('div.text').should('have.text', 'from the user message');
        // values
        cy.dataCy('entity-dropdown').find('div.text').should('have.text', 'shop');
        cy.get('.ui.label').contains('chitchat.greet').should('exist');
        cy.get('.ui.label').contains('chitchat.bye').should('exist');
        cy.dataCy('category-value-dropdown').find('div.text').should('have.text', 'blue');
        cy.get('.story-card').find('[data-cy=icon-trash]').last().click();
        cy.get('.story-card').find('[data-cy=icon-trash]').first().click();
        cy.dataCy('extraction-source-dropdown').should('have.length', 1);
        cy.dataCy('intent-condition-dropdown').click();
        cy.dataCy('intent-condition-dropdown').find('span').contains('if the intent is one of').click();
        cy.dataCy('intent-condition-dropdown').find('div.text').should('have.text', 'if the intent is one of');
        cy.reload();
        cy.wait(5000); // wait for story menu to appear

        cy.selectForm('Groupo_form');
        cy.dataCy('slot-node-wrapper-catSlot').click();
        cy.dataCy('form-top-menu-item').contains('Extraction').click();
        cy.dataCy('form-top-menu-item').contains('Extraction').click();
        cy.dataCy('extraction-source-dropdown').should('have.length', 1);
        cy.dataCy('intent-condition-dropdown').click();
        cy.dataCy('intent-condition-dropdown').find('span').contains('if the intent is one of').click();
        cy.dataCy('intent-condition-dropdown').find('div.text').should('have.text', 'if the intent is one of');
    });
});
