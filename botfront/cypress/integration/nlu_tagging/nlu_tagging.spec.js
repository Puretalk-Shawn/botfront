/* global cy */

describe('nlu tagging in training data', function() {
    beforeEach(function() {
        cy.createProject('bf', 'My Project', 'fr').then(() => {
            cy.login();
            cy.import('bf', 'nlu_import.json', 'fr');
        });
    });

    afterEach(function() {
        cy.logout();
        cy.deleteProject('bf');
    });
    
    it('should be able to change the intent with a popup', function() {
        cy.visit('/project/bf/nlu/models');
        cy.get('.row:contains(chitchat.presentation)')
            .eq(0)
            .findCy('intent-label')
            .click({ force: true })
            .type('chitchat.tell_me_a_joke{enter}');
        cy.get('.row:contains(chitchat.tell_me_a_joke)');
    });

    it('should delete the training data', function() {
        cy.visit('/project/bf/nlu/models');
        cy.get('.row:contains(chitchat.presentation)')
            .eq(0)
            .findCy('icon-trash')
            .click({ force: true });
        cy.get('.row:contains(chitchat.presentation)').should('have.length', 1);
    });

    it('should be able to change an entity with a popup', function() {
        cy.visit('/project/bf/nlu/models');
        cy.get('.row:contains(chitchat.presentation)')
            .eq(0)
            .findCy('entity-label')
            .click();
        cy.dataCy('entity-dropdown')
            .find('input')
            .type('person{enter}');
        cy.get('.row:contains(person)');
    });

    it('should remove the draft status on the example', function() {
        cy.visit('/project/bf/nlu/models');
        cy.addExamples(['testa', 'testb']);
        cy.get('.row').eq(0).click().should('have.class', 'selected');
        cy.get('body').type('{shift}', { release: false });
        cy.get('.row').eq(1).click();
        cy.get('.row.selected').should('have.length', 2);
        cy.get('body').type('{shift}');
        cy.changeIntentOfSelectedUtterances('test_intent');
        cy.get('.virtual-table').focus();
        cy.dataCy('draft-button').should('have.length', 2);
        cy.get('body').type('s');
        cy.get('@texts').then((texts) => { if (texts.length > 1) cy.yesToConfirmation(); });
        cy.dataCy('draft-button').should('not.exist');
    });
});
