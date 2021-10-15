/* global cy Cypress:true */
/* eslint-disable no-await-in-loop */
// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import './chat.commands';
import gql from 'graphql-tag';
import './nlu.commands';
import './story.commands';
import './response.commands';
import './incoming.commands';
import './settings.commands';
import './conversation.commands';
import './form.commands';
import './slot.commands';

const axios = require('axios');

Cypress.on('uncaught:exception', () => false);

Cypress.Screenshot.defaults({
    screenshotOnRunFailure: !!JSON.parse(
        String(Cypress.env('SCREENSHOTS')).toLowerCase(),
    ),
});

const ADMIN_EMAIL = 'test@test.com';
const SPECIAL_USER_EMAIL = 'test@test.test';

const UPSERT_ROLES_DATA = gql`
    mutation upsertRolesData($roleData: RoleDataInput!) {
        upsertRolesData(roleData: $roleData) {
            name
        }
    }
`;

const DELETE_ROLE_DATA = gql`
    mutation deleteRolesData($name: String!, $fallback: String!) {
        deleteRolesData(name: $name, fallback: $fallback)
    }
`;

const CREATE_AND_OVERWRITE_RESPONSES = gql`
    mutation createAndOverwriteResponses(
        $projectId: String!
        $responses: [BotResponseInput]
    ) {
        createAndOverwriteResponses(projectId: $projectId, responses: $responses) {
            key
        }
    }
`;

function abortEarly() {
    if (this.currentTest.state === 'failed' && this.currentTest.currentRetry() === this.currentTest.retries()) {
        Cypress.runner.stop();
    }
}
beforeEach(abortEarly);
afterEach(abortEarly);

Cypress.Commands.add(
    'login',
    ({
        visit = true, email, password = 'Aaaaaaaa00', admin = true,
    } = {}) => {
        const withEmail = email || admin ? ADMIN_EMAIL : SPECIAL_USER_EMAIL;
        if (visit) cy.visit('/');
        cy.logout();
        cy.window()
            .then(
                ({ Meteor }) => new Cypress.Promise((resolve, reject) => {
                    Meteor.logout((err) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve();
                    });
                }),
            )
            .then(
                ({ Meteor, Accounts }) => new Cypress.Promise((resolve, reject) => {
                    Meteor.loginWithPassword(withEmail, password, (loginError) => {
                        if (loginError) return reject(loginError);
                        cy.wrap(Accounts._storedLoginToken()).as('loginToken'); // eslint-disable-line no-underscore-dangle
                        return resolve();
                    });
                }),
            );
    },
);

Cypress.Commands.add('logout', () => {
    cy.window().then(
        ({ Meteor }) => new Cypress.Promise((resolve, reject) => {
            Meteor.logout((err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        }),
    );
});

Cypress.Commands.add('MeteorCallAdmin', (method, args) => {
    cy.login();
    cy.window().then(
        ({ Meteor }) => new Cypress.Promise((resolve) => {
            Meteor.call(method, ...args, (err, res) => {
                if (err) resolve(err);
                resolve(res);
            });
        }),
    );
    cy.logout();
});

Cypress.Commands.add('MeteorCall', (method, args) => {
    cy.window().then(
        ({ Meteor }) => new Cypress.Promise((resolve) => {
            Meteor.call(method, ...args, (err, res) => {
                if (err) resolve(err);
                resolve(res);
            });
        }),
    );
});

Cypress.Commands.add(
    'createNLUModel',
    (projectId, name, language, description, instance = false) => {
        cy.visit(`/project/${projectId}/nlu/models`);
        cy.get('.new-model').click();
        cy.get('#uniforms-0000-0001').type(name);
        cy.get('#uniforms-0000-0002 > .search').click();
        cy.get('#uniforms-0000-0002 > .search').type(language);
        cy.get('#uniforms-0000-0002').contains(language).click();
        if (description) cy.get('#uniforms-0000-0004').type(description);
        if (instance) {
            cy.get('#uniforms-0000-0005').click();
            cy.get('#uniforms-0000-0005').find('[role=option]').first().click();
            // Save
        }
        cy.get('[data-cy=model-save-button]').click();
    },
);

Cypress.Commands.add('createNLUModelProgramatically', (projectId, name, language) => cy
    .window()
    .then(({ Meteor }) => cy
        .fixture('lite-pipeline.yaml')
        .then(config => Meteor.callWithPromise('nlu.insert', projectId, language, config))));

Cypress.Commands.add('MeteorCall', (method, args) => {
    cy.window().then(
        ({ Meteor }) => new Cypress.Promise((resolve) => {
            Meteor.call(method, ...args, (err, res) => {
                if (err) resolve(err);
                resolve(res);
            });
        }),
    );
});

Cypress.Commands.add('deleteNLUModel', (projectId, name, language) => {
    cy.visit(`/project/${projectId}/nlu/models`);
    cy.contains(language).click();
    cy.get(`#model-${name} [data-cy=open-model]`).first().click();
    cy.dataCy('nlu-menu-settings').click();
    cy.contains('Delete').click();
    cy.dataCy('nlu-menu-settings').click();
    cy.get('.dowload-model-backup-button').click();
    cy.get('.delete-model-button').click();
    cy.get('.ui.page.modals').should('be.visible');
    cy.get('.ui.page.modals .primary').click();
});

Cypress.Commands.add('setTimezoneOffset', (providedOffset = null) => {
    const offset = providedOffset || new Date().getTimezoneOffset() / -60;
    cy.visit('/project/bf/settings');
    cy.get('[data-cy=change-timezone-offset] input')
        .click()
        .type(`{backspace}{backspace}{backspace}{backspace}${offset}`);
    cy.get('[data-cy=save-changes]').click();
});

Cypress.Commands.add('createResponse', (projectId, responseName) => {
    cy.visit(`/project/${projectId}/responses/add`);
    cy.get('[data-cy=response-name] input').type(responseName);
    cy.get('.response-message-next.sequence-add-message').click();
    cy.get('.response-message-next.sequence-add-message').contains('Text').click();
    cy.get('.response-save-button').click();
});

Cypress.Commands.add('openResponse', (projectId, responseName) => {
    cy.visit(`/project/${projectId}/responses`);
    // Type bot response name in filter
    cy.get('[style="flex: 200 0 auto; width: 200px; max-width: 200px;"] > input').clear();
    cy.get('[style="flex: 200 0 auto; width: 200px; max-width: 200px;"] > input').type(
        responseName,
    );
    cy.get('[data-cy=edit-response-0]').click();
});

Cypress.Commands.add('deleteResponse', (projectId, responseName) => {
    cy.visit(`/project/${projectId}/responses`);
    // Type bot response name in filter
    cy.get('[style="flex: 200 0 auto; width: 200px; max-width: 200px;"] > input').clear();
    cy.get('[style="flex: 200 0 auto; width: 200px; max-width: 200px;"] > input').type(
        responseName,
    );
    cy.get('[data-cy=remove-response-0]').click();
});

Cypress.Commands.add('deleteProject', projectId => cy
    .visit('/')
    .then(() => cy.login())
    .then(() => cy.window())
    .then(({ Meteor }) => Meteor.callWithPromise('project.delete', projectId, {
        failSilently: true,
        bypassWithCI: true,
    })));

Cypress.Commands.add(
    'createProject',
    (projectId = 'bf', name = 'My Project', defaultLanguage = 'en') => {
        const project = {
            _id: projectId,
            name,
            defaultLanguage,
            namespace: `bf-${projectId}`,
            languages: [],
        };
        cy.deleteProject(projectId);
        cy.visit('/');
        return cy.fixture('lite-policies.yaml').then(policies => cy.window().then(async ({ Meteor }) => {
            await Meteor.callWithPromise('project.insert', project);
            await Meteor.callWithPromise('policies.save', {
                projectId,
                policies,
            });
            return cy.createNLUModelProgramatically(projectId, '', defaultLanguage);
        }));
    },
);

Cypress.Commands.add('dataCy', (dataCySelector, content = null, filter = null) => {
    let result;
    if (!content) result = cy.get(`[data-cy=${dataCySelector}]`);
    else result = cy.get(`[data-cy=${dataCySelector}]:contains(${content})`);
    const filtered = filter ? result.filter(filter) : result;
    if (filtered.length > 1) {
        // go for exact match
        return filtered.contains(
            new RegExp(`^${content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
        );
    }
    return filtered;
});

Cypress.Commands.add('findCy', { prevSubject: 'element' }, (subject, dataCySelector) => subject.find(`[data-cy=${dataCySelector}]`));

Cypress.Commands.add('escapeModal', (letFail = false) => {
    cy.get('.modals.dimmer').click('topRight');
    if (!letFail) cy.get('.dimmer').should('not.exist');
});

Cypress.Commands.add('yesToConfirmation', () => cy.get('.modals.dimmer').should('exist').find('.ui.primary.button').click());

Cypress.Commands.add(
    'upload',
    {
        prevSubject: 'element',
    },
    (subject, file, fileName) => {
        // we need access window to create a file below
        cy.window().then((window) => {
            const blob = new Blob([JSON.stringify(file, null, 2)], {
                type: 'text/plain;charset=utf-8',
            });
            // Please note that we need to create a file using window.File,
            // cypress overwrites File and this is not compatible with our change handlers in React Code
            const testFile = new window.File([blob], fileName);
            const dataTransfer = {
                dataTransfer: { files: [testFile], types: ['Files'] },
            };
            cy.wrap(subject).trigger('dragenter', dataTransfer);
            cy.wrap(subject).trigger('drop', dataTransfer);
        });
    },
);

Cypress.Commands.add(
    'uploadTxt',
    {
        prevSubject: 'element',
    },
    (subject, text, fileName) => {
        // we need access window to create a file below

        cy.window().then((window) => {
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            // Please note that we need to create a file using window.File,
            // cypress overwrites File and this is not compatible with our change handlers in React Code
            const testFile = new window.File([blob], fileName);
            const dataTransfer = {
                dataTransfer: { files: [testFile], types: ['Files'] },
            };
            cy.wrap(subject).trigger('dragenter', dataTransfer);
            cy.wrap(subject).trigger('drop', dataTransfer);
        });
    },
);

Cypress.Commands.add(
    'uploadBlob',
    {
        prevSubject: 'element',
    },
    (subject, blob, fileName) => {
        // we need access window to create a file below

        cy.window().then((window) => {
            // Please note that we need to create a file using window.File,
            // cypress overwrites File and this is not compatible with our change handlers in React Code
            const testFile = new window.File([blob], fileName);
            const dataTransfer = {
                dataTransfer: { files: [testFile], types: ['Files'] },
            };
            cy.wrap(subject).trigger('dragenter', dataTransfer);
            cy.wrap(subject).trigger('drop', dataTransfer);
        });
    },
);

Cypress.Commands.add(
    'dragTo',
    { prevSubject: 'element' },
    (source, node, dataCy = true) => {
        cy.wrap(source).trigger('dragstart');
        (dataCy ? cy.dataCy(node) : cy.get(node)).then((destination) => {
            cy.wrap(destination).trigger('dragenter');
            cy.wrap(destination).trigger('drop');
        });
    },
);

Cypress.Commands.add('createUser', (lastName, email, roles, projectId) => {
    cy.visit('/');
    cy.window()
        .then(
            ({ Meteor }) => new Cypress.Promise((resolve, reject) => {
                Meteor.call(
                    'user.create',
                    {
                        profile: {
                            firstName: 'test',
                            lastName,
                        },
                        email,
                        roles: [
                            {
                                project: projectId,
                                roles,
                            },
                        ],
                        sendEmail: false,
                    },
                    true,
                    (err, result) => {
                        if (err) {
                            reject(err);
                        }
                        resolve({ Meteor, result });
                    },
                );
            }),
        )
        .then(
            ({ Meteor, result }) => new Cypress.Promise((resolve, reject) => {
                Meteor.call('user.changePassword', result, 'Aaaaaaaa00', (err) => {
                    if (err) {
                        reject(err);
                    }
                    resolve({ Meteor, result });
                });
            }),
        );
});

Cypress.Commands.add('deleteUser', (email) => {
    cy.visit('/');
    cy.logout();
    cy.login().then(() => cy.MeteorCall('user.removeByEmail', [email]));
});

Cypress.Commands.add('createRole', (name, desc, permissions) => {
    cy.visit('/');
    cy.login().then(() => {
        cy.window().then(({ __APOLLO_CLIENT__ }) => __APOLLO_CLIENT__.mutate({
            mutation: UPSERT_ROLES_DATA,
            variables: {
                roleData: {
                    name,
                    description: desc,
                    children: permissions,
                },
            },
        }));
    });
});

Cypress.Commands.add('deleteRole', (name, fallback) => {
    cy.visit('/');
    cy.login().then(() => {
        cy.visit('/');
        cy.window().then(({ __APOLLO_CLIENT__ }) => __APOLLO_CLIENT__.mutate({
            mutation: DELETE_ROLE_DATA,
            variables: {
                name,
                fallback,
            },
        }));
    });
});

Cypress.Commands.add(
    'createDummyRoleAndUser',
    ({
        email = SPECIAL_USER_EMAIL,
        desc,
        name = 'dummy',
        permission,
        scope = 'bf',
    } = {}) => {
        cy.createRole(name, desc || name, permission);
        cy.createUser('test', email, 'dummy', scope);
    },
);

Cypress.Commands.add(
    'removeDummyRoleAndUser',
    ({ email = SPECIAL_USER_EMAIL, name = 'dummy', fallback = 'global-admin' } = {}) => {
        cy.deleteUser(email);
        cy.deleteRole(name, fallback);
    },
);

Cypress.Commands.add('addResponses', (projectId, responses) => {
    cy.visit('/');
    cy.login();
    cy.window().then(({ __APOLLO_CLIENT__ }) => __APOLLO_CLIENT__.mutate({
        mutation: CREATE_AND_OVERWRITE_RESPONSES,
        variables: {
            projectId,
            responses,
        },
    }));
});

Cypress.Commands.add('removeTestConversation', (id) => {
    cy.MeteorCallAdmin('conversations.delete', [id]);
});

Cypress.Commands.add(
    'addTestConversation',
    (projectId, { id = 'abc', env = null, lang = 'en' }) => {
        const body = JSON.stringify({
            conversations: [
                {
                    _id: id,
                    env,
                    tracker: {
                        events: [
                            {
                                event: 'user',
                                text: `${id}-blah-blah-${lang}`,
                                metadata: { language: lang },
                                parse_data: {
                                    intent: { name: null, confidence: 0 },
                                    entities: [],
                                    text: `${id}-blah-blah`,
                                },
                                input_channel: 'webchat',
                                timestamp: new Date().getTime() / 1000,
                            },
                        ],
                        slots: {
                            latest_response_name: null,
                            followup_response_name: null,
                            parse_data: null,
                        },
                        latest_input_channel: 'socketio',
                        paused: false,
                        followup_action: null,
                        latest_message: {
                            text: `${id}-blah-blah-${lang}`,
                            entities: [],
                            intent_ranking: [
                                {
                                    name: 'get_started',
                                    confidence: 1,
                                },
                            ],
                            intent: {
                                name: 'get_started',
                                confidence: 1,
                            },
                        },
                        sender_id: id,
                        latest_event_time: '2019-10-08T18:52:46.343Z',
                        latest_action_name: 'action_listen',
                    },
                    status: 'read',
                    projectId,
                    createdAt: '2019-10-08T18:52:46.343Z',
                    updatedAt: '2019-10-08T18:52:46.343Z',
                },
            ],
            processNlu: true,
        });

        cy.request({
            method: 'POST',
            url: `${Cypress.env('API_URL')}/conversations/bf/environment/${env}?api-key=`,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    },
);

// Add and remove slot programatically.
Cypress.Commands.add('addSlot', (projectId) => {
    const commandToAddStory = `mongo meteor --host localhost:3001 --eval "db.slots.insert({
        _id: 'DELETESLOT',
        projectId: '${projectId}',
        name: 'Test',
        type: 'bool',
    });"`;
    cy.exec(commandToAddStory);
});

Cypress.Commands.add('removeSlot', () => {
    const commandToRemoveStory = 'mongo meteor --host localhost:3001 --eval "db.slots.remove({ _id: \'DELETESLOT\'});"';
    cy.exec(commandToRemoveStory);
});

Cypress.Commands.add(
    'waitForResolve',
    (url, maxTries = 1000) => new Cypress.Promise(async function (resolve, reject) {
        for (let i = 1; i < Number.MAX_VALUE; i += 1) {
            try {
                await axios(url);
                resolve();
                break;
            } catch (error) {
                if (!error.toString().includes('ERR_EMPTY_RESPONSE')) {
                    resolve();
                    break;
                }
                if (i > maxTries) reject(`Can't connect to ${url}`);
            }
        }
    }),
);

Cypress.Commands.add('getWindowMethod', (methodName) => {
    cy.window().then(
        window => new Cypress.Promise((resolve, reject) => {
            let i = 0;
            const checkIfExists = () => {
                if (i > 200) return reject();
                if (window[methodName]) return resolve(window[methodName]);
                i += 1;
                return setTimeout(checkIfExists, 50);
            };
            checkIfExists();
        }),
    );
});

Cypress.Commands.add(
    'import',
    (projectId = 'bf', fixture, fallbackLang = 'en', wipeInvolvedCollections = false) => {
        cy.fixture(fixture, 'utf8').then((loadedFixture) => {
            let file = typeof loadedFixture === 'string'
                ? loadedFixture
                : JSON.stringify(loadedFixture);
            file = new File([file], fixture);
            file.filename = fixture;
            cy.graphQlQuery(
                `mutation import($projectId: String!, $files: [Upload]!, $wipeInvolvedCollections: Boolean = false, $fallbackLang: String!) {
                import(projectId: $projectId, files: $files, wipeInvolvedCollections: $wipeInvolvedCollections, fallbackLang: $fallbackLang) {  
                    summary { text, longText }
                }
            }`,
                {
                    projectId,
                    fallbackLang,
                    wipeInvolvedCollections,
                    files: [file],
                },
            );
        });
        return cy.wait(500);
    },
);

Cypress.Commands.add('train', (waitTime = 300000) => {
    cy.visit('/project/bf/dialogue');
    cy.dataCy('train-button').should('exist').should('not.have.class', 'disabled');
    cy.wait(1500);
    cy.dataCy('train-button').click({ force: true });
    cy.dataCy('train-button').should('have.class', 'disabled');
    cy.get('[data-cy=train-button]', { timeout: waitTime }).should(
        'not.have.class',
        'disabled',
    );
});

const MONTHS = [
    '', // January is /01/ not /00/
    'January',
    'Febuary',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];
Cypress.Commands.add('findMonth', (queryMonth, index, incomingSearchPrev) => {
    cy.log(`finding month step ${index}`);
    let searchPrev = incomingSearchPrev !== undefined ? incomingSearchPrev : true;
    let shouldExit = false;
    if (index > 36) {
        return; // stop it from clicking next month FOREVER
    }
    // check if the queryMonth is currently loaded in the datepicker
    if (index === 0) {
        cy.get('.visible.date-picker')
            .find('.CalendarMonth')
            .find('.CalendarMonth_caption')
            .find('strong')
            .each((element) => {
                // cy.XXX is a promise so the exit has to be here rather than in the body
                if (shouldExit === true) return;
                // if the query month is currently rendered, exit the function
                const currentMonthStr = element[0].childNodes[0].data;
                if (currentMonthStr === queryMonth) {
                    shouldExit = true;
                    return;
                }
                // if queryMonth is in the future; search future months
                if (currentMonthStr === queryMonth) {
                    const currentMonth = currentMonthStr.split(' ');
                    currentMonth[0] = MONTHS.indexOf(currentMonth[0]);
                    if (
                        currentMonth[1] < MONTHS.indexOf(queryMonth.split(' ')[1])
                        || (currentMonth[0] < queryMonth.split(' ')[0]
                            && currentMonth[1] === queryMonth[1])
                    ) {
                        searchPrev = false;
                    }
                }
            });
    }
    cy.get('.visible.date-picker')
        .find('.CalendarMonth')
        .find('.CalendarMonth_caption')
        .first()
        .find('strong')
        .then((element) => {
            // cy.XXX is a promise so the exit has to be here rather than in the body
            if (shouldExit === true) return;
            const currentMonth = element[0].childNodes[0].data;
            if (currentMonth !== queryMonth) {
                if (searchPrev === true) {
                    cy.get('.DayPickerNavigation_button').first().click();
                } else {
                    cy.get('.DayPickerNavigation_button').last().click();
                }
                cy.findMonth(queryMonth, index + 1, searchPrev);
            }
        });
});
Cypress.Commands.add(
    'pickDateRange',
    (datePickerIndex, firstDateStr, secondDateStr, all = false) => {
        /*
        clicks on firstDateStr, then clicks on SecondDateStr, then confirms the date selection
        ----------------------------------------------------------
        firstDateStr and secondDateStr should be a string 'dd/m/yyyy'
        August 1st 2019 would be 1/8/2019 NOT 1/08/2019
        November 17th 2019 would be 17/11/2019
    */
        const firstDate = firstDateStr.split('/');
        const secondDate = secondDateStr.split('/');
        let searchFutureMonths = false;

        cy.dataCy('date-picker-container').eq(datePickerIndex).click();
        cy.findMonth(`${MONTHS[firstDate[1]]} ${firstDate[2]}`, 0);
        cy.get('.visible.date-picker')
            .first()
            .contains(`${MONTHS[firstDate[1]]} ${firstDate[2]}`)
            .parents('.CalendarMonth')
            .find('.CalendarDay')
            .contains(firstDate[0])
            .click({ force: true });

        if (
            firstDate[3] < secondDate[3]
            || (firstDate[2] < secondDate[2] && firstDate[3] === secondDate[3])
        ) {
            searchFutureMonths = true;
        }
        cy.findMonth(`${MONTHS[secondDate[1]]} ${secondDate[2]}`, 0, searchFutureMonths);
        cy.get('.visible.date-picker')
            .first()
            .contains(`${MONTHS[secondDate[1]]} ${secondDate[2]}`)
            .parents('.CalendarMonth')
            .find('.CalendarDay')
            .contains(secondDate[0])
            .click({ force: true });
        cy.get('.visible.date-picker')
            .first()
            .findCy(all ? 'apply-new-dates-to-all' : 'apply-new-dates')
            .click({ force: true });
    },
);

const objectToFormData = (obj) => {
    // this traverses the query/variables object and makes it graphql-upload-compliant
    // cf. https://github.com/jaydenseric/graphql-multipart-request-spec#curl-request
    const formData = new FormData();
    const foundFiles = {};
    const fileDigger = (input, path = '') => {
        if (input instanceof File) {
            foundFiles[path] = input;
            return null;
        }
        if (Array.isArray(input)) {
            return input.map((child, i) => fileDigger(child, `${path}.${i}`, foundFiles));
        }
        if (input && typeof input === 'object') {
            return Object.entries(input).reduce(
                (acc, [k, v]) => ({
                    ...acc,
                    [k]: fileDigger(v, `${path}${path ? '.' : ''}${k}`, foundFiles),
                }),
                {},
            );
        }
        return input;
    };
    const dug = fileDigger(obj);
    formData.append('operations', JSON.stringify({ operationName: null, ...dug }));
    const map = {};
    const files = [];
    Object.entries(foundFiles).forEach(([k, v], i) => {
        map[i] = [k];
        files.push([i, v]);
    });
    formData.append('map', JSON.stringify(map));
    files.forEach(([i, v]) => formData.append(i, v));
    return formData;
};

Cypress.Commands.add('graphQlQuery', (query, variables) => cy.get('@loginToken').then((token) => {
    const formData = objectToFormData({ variables, query });
    return cy.formRequest('post', '/graphql', formData, token);
}));

Cypress.Commands.add(
    'formRequest',
    (method, url, formData, authorization) => new Cypress.Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.setRequestHeader('Authorization', authorization);
        xhr.onload = () => resolve(xhr);
        xhr.onerror = () => reject(xhr);
        xhr.send(formData);
    }),
);

Cypress.Commands.add(
    'insertNluExamples',
    (projectId, language = 'en', examples, autoAssignCanonical = true) => cy.graphQlQuery(
        `mutation insertExamples($projectId: String!, $language: String!, $examples: [ExampleInput]!, $autoAssignCanonical: Boolean) {
        insertExamples(projectId: $projectId, language: $language, examples: $examples, autoAssignCanonical: $autoAssignCanonical) {  
            _id
        }
    }`,
        {
            projectId,
            language,
            examples,
            autoAssignCanonical,
        },
    ),
);

Cypress.Commands.add(
    'addConversation',
    (projectId, id, conversation, env = 'development') => cy.graphQlQuery(
        `mutation ($tracker: Any) {\n  insertTrackerStore(senderId: "${id}", projectId: "${projectId}", tracker: $tracker, env: ${env}){\n  lastIndex\n  }\n}`,
        { tracker: conversation },
    ),
);

Cypress.Commands.add(
    'updateConversation',
    (projectId, id, conversation, env = 'development') => cy.graphQlQuery(
        `mutation ($tracker: Any) {\n  updateTrackerStore(senderId: "${id}", projectId: "${projectId}", tracker: $tracker, env: ${env}){\n  lastIndex\n  }\n}`,
        { tracker: conversation },
    ),
);

Cypress.Commands.overwrite('log', (subject, message) => cy.task('log', message));

Cypress.Commands.add('getBranchContainer', (depth) => {
    /*
    gets the contents of a branch including contents of following branches
    and branch menus. this does not include the specified branches branch-menu
    */
    let branch = cy.dataCy('single-story-editor').first();
    for (let i = 0; i < depth; i += 1) {
        branch = branch.find('[data-cy=single-story-editor]').first();
    }
    return branch;
});

// get the contents of the visual editor for a branch
Cypress.Commands.add('getBranchEditor', depth => cy.getBranchContainer(depth).find('.story-visual-editor').first());

Cypress.Commands.add(
    'fill',
    {
        prevSubject: 'element',
    },
    ($subject, value) => {
        const el = $subject[0];
        el.value = value;
        return cy.wrap($subject).type('t{backspace}'); // adding/removing character trigger the one change
    },
);

Cypress.Commands.add('setPolicies', (projectId, policies) => {
    cy.MeteorCall('policies.save', [{ projectId, policies }]);
});

Cypress.Commands.add('changeEnv', (env) => {
    cy.dataCy('env-selector').click();
    cy.dataCy('env-selector').find('div.menu').contains(env).click();
});

Cypress.Commands.add('setTestGitSettings', (info) => {
    const { publicKey, privateKey, fullName } = info;
    cy.visit('/project/bf/settings/git-credentials');
    cy.dataCy('git-string').find('input').type(`git@github.com:${fullName}#main`);
    cy.dataCy('public-ssh-key')
        .find('input')
        .focus()
        .invoke('val', publicKey)
        .trigger('change')
        .type(' ')
        .blur();
    cy.dataCy('private-ssh-key')
        .find('textarea')
        .focus()
        .invoke('val', privateKey)
        .trigger('change')
        .type(' ')
        .blur();
    cy.dataCy('save-button').click();
});

Cypress.Commands.add('tearDownGitRepo', info => cy.task('octoRequest', [`DELETE /repos/${info.fullName}`]));

Cypress.Commands.add('setUpGitRepo', () => {
    const templateRepo = Cypress.env('GITHUB_TEMPLATE_REPO');
    const owner = templateRepo.split('/')[0];
    cy.task('generateShortId').then(shortId => cy.task('octoRequest', [
        `POST /repos/${templateRepo}/generate`,
        {
            name: shortId,
            owner,
            private: true,
            mediaType: { previews: ['baptiste'] },
        },
    ])
        .then(({ status, data: { full_name: fullName } = {} }) => {
            // can't catch, but we alias the repo name as early as possible to
            // be able to delete it in the aftereach block
            cy.wrap({ status, fullName }).as('gitRepo');
            if (status !== 201) throw new Error();
            cy.task('generatePair').then(({ publicKey, privateKey }) => {
                cy.wrap({ fullName, publicKey, privateKey }).as('gitRepo');
                cy.task('octoRequest', [
                    `POST /repos/${fullName}/keys`,
                    { key: publicKey, read_only: false },
                ]);
            });
        }));
});
