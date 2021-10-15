import { safeLoad, safeDump } from 'js-yaml';
import { isEqual } from 'lodash';
import uuidv4 from 'uuid/v4';
import { Projects } from '../../api/project/project.collection';
import { GlobalSettings } from '../../api/globalSettings/globalSettings.collection';

import { onlyValidFiles } from './common';

const INTERNAL_SLOTS = ['bf_forms', 'fallback_language', 'disambiguation_message'];

// deduplicate response and merge them by lang
export const deduplicateAndMergeResponses = (listOfResponse) => {
    // for a said key, seen will store supported lang and where the response is in the final array
    // eg. { utter_test: { langs :['en','fr'], index: 2 }};
    const seen = {};
    return listOfResponse.reduce((all, resp) => {
        const { key } = resp;
        const respSeen = seen[key];
        if (respSeen) {
            // the reponse was already added
            const insertIndex = respSeen.index;
            // we filter out lang already supported for a said key
            const langToAdd = resp.values.filter(
                val => !respSeen.langs.includes(val.lang),
            );
            // add newly supported lang to the seen ones
            const newLangs = langToAdd.map(val => val.lang);
            seen[key] = { langs: [...respSeen.langs, ...newLangs], index: insertIndex };
            // update the final array
            const updatedResp = all[insertIndex];
            updatedResp.values.push(...langToAdd);
            return [
                ...all.slice(0, insertIndex),
                updatedResp,
                ...all.slice(insertIndex + 1),
            ];
        }
        // it's the first time we see this response
        // list all lang supported
        const langs = resp.values.map(val => val.lang);
        //  add those to the seen, as well as the index
        seen[key] = { langs, index: all.length };
        // add the response
        return [...all, resp];
    }, []);
};

export const deduplicateArray = (array, key = null) => {
    const seen = new Set();
    return array.filter((item) => {
        const value = key ? item[key] : item;
        if (seen.has(value)) {
            return false;
        }
        seen.add(value);
        return true;
    });
};

export const mergeDomains = (files) => {
    const filesToProcess = files.filter(
        file => !(file.errors && file.errors.length > 0),
    );
    if (!filesToProcess.length) {
        return {
            slots: [],
            responses: [],
            forms: {},
            bfForms: [],
            actions: [],
        };
    }
    const allResponses = filesToProcess.reduce(
        (all, { responses = [] }) => [...all, ...responses],
        [],
    );
    // the order of merging is important
    // for arrays [...all, ...slots] => will keep the first one during deduplication
    // for obj { ...forms, ...all } => the first one found erase the new one
    const allSlots = filesToProcess.reduce(
        (all, { slots = [] }) => [...all, ...slots],
        [],
    );
    const allForms = filesToProcess.reduce(
        (all, { forms = {} }) => ({ ...forms, ...all }),
        {},
    );
    const allBfForms = filesToProcess.reduce(
        (all, { bfForms = [] }) => [...all, ...bfForms],
        [],
    );
    const allAction = filesToProcess.reduce(
        (all, { actions = [] }) => [...all, ...actions],
        [],
    );
    const mergedResponses = deduplicateAndMergeResponses(allResponses);
    const mergedSlots = deduplicateArray(allSlots, 'name');
    const mergedBfForms = deduplicateArray(allBfForms, 'name');
    const mergedActions = deduplicateArray(allAction);
    return {
        slots: mergedSlots,
        responses: mergedResponses,
        forms: allForms,
        bfForms: mergedBfForms,
        actions: mergedActions,
    };
};

const mergeDefaultDomains = (files) => {
    const filesToProcess = onlyValidFiles(files);
    if (!filesToProcess.length) {
        return {
            slots: {},
            responses: {},
            forms: {},
            actions: [],
        };
    }
    // the order of merging is important
    // for arrays [...all, ...slots] => will keep the first one during deduplication
    // for obj { ...forms, ...all } => the first one found erase the new one

    const allResponses = filesToProcess.reduce((all, { responses = {} }) => {
        let toInsert = {};
        Object.keys(responses).forEach((respKey) => {
            const currentResp = responses[respKey];
            if (all[respKey]) {
                const existingResps = all[respKey];
                // the existing one are put in first so during deduplication they will be kept
                const newResp = deduplicateArray(
                    [...existingResps, ...currentResp],
                    'lang',
                );
                toInsert = { ...toInsert, [respKey]: newResp };
            } else {
                toInsert = { ...toInsert, [respKey]: currentResp };
            }
        });
        // "toInsert" is after "all", because "toInsert" might contain an updated version of a respone in "all"
        return { ...all, ...toInsert };
    }, {});
    const allSlots = filesToProcess.reduce(
        (all, { slots = {} }) => ({ ...slots, ...all }),
        {},
    );
    const allForms = filesToProcess.reduce(
        (all, { forms = {} }) => ({ ...forms, ...all }),
        {},
    );
    const allAction = filesToProcess.reduce(
        (all, { actions = [] }) => [...all, ...actions],
        [],
    );
    const mergedActions = deduplicateArray(allAction); // we are not using a set to deduplicate to keep the order of the actions
    return {
        ...(Object.keys(allSlots).length ? { slots: allSlots } : {}),
        ...(Object.keys(allResponses).length ? { responses: allResponses } : {}),
        ...(Object.keys(allForms).length ? { forms: allForms } : {}),
        ...(mergedActions.length ? { actions: mergedActions } : {}),
    };
};

const validateADomain = (
    file,
    {
        defaultDomain = {},
        projectLanguages = [],
        actionsFromFragments = [],
        fallbackLang,
    },
    // we validate domain and default domain with the same function
    // isDefaultDomain allow us to get the domain in rasaformat
    // and also triggers specific warning linked to default domain
    isDefaultDomain = false,
) => {
    const { rawText } = file;
    let domain;
    try {
        domain = safeLoad(rawText);
    } catch (e) {
        return {
            ...file,
            errors: [...(file?.errors || []), `Not valid yaml: ${e.message}`],
        };
    }
    const {
        slots: { bf_forms: { initial_value: bfForms = [] } = {}, ...slotsFromFile } = {},
        templates: legacyResponsesFromFile = {},
        responses: modernResponsesFromFile = {},
        forms: mixedFormsFromFile = {},
        actions: actionsFromFile = [],
    } = domain;
    const { slots: defaultSlots = {}, responses: defaultResponses = {} } = defaultDomain;
    const responsesFromFile = {
        ...(legacyResponsesFromFile || {}),
        ...(modernResponsesFromFile || {}),
    };
    let formsFromFile = {};
    if (
        mixedFormsFromFile
        && typeof mixedFormsFromFile === 'object'
        && !Array.isArray(mixedFormsFromFile)
    ) {
        formsFromFile = Object.entries(mixedFormsFromFile).reduce((acc, [name, spec]) => {
            if (!('graph_elements' in spec)) return { ...acc, [name]: spec };
            bfForms.push(spec); // "if it has graph elements, it must be a bf form!"
            return acc;
        }, {});
    }

    if (!isDefaultDomain) {
        // do not import slots that are in current default domain or are programmatically generated
        [...Object.keys(defaultSlots), ...INTERNAL_SLOTS].forEach((k) => {
            delete slotsFromFile[k];
        });
        // do not import responses that are in current default domain
        Object.keys(defaultResponses).forEach((k) => {
            delete responsesFromFile[k];
        });
    }

    const warnings = [];
    const responses = [];
    let responsesRasaFormat = {};
    const slots = [];
    const newLanguages = new Set();
    const newLangsResponses = {};

    Object.keys(responsesFromFile).forEach((key) => {
        const response = responsesFromFile[key];
        const values = [];
        let firstMetadataFound;
        response.forEach((item) => {
            const { language, metadata, ...rest } = item;
            const content = typeof item === 'string' ? safeDump({ text: item }) : safeDump(rest);
            const lang = language || fallbackLang;
            if (!firstMetadataFound && metadata) firstMetadataFound = metadata;
            if (firstMetadataFound && !isEqual(firstMetadataFound, metadata)) {
                warnings.push(
                    `Different metadata found for single response '${key}', but Botfront does not support it. The first one will prevail.`,
                );
            }
            if (!projectLanguages.includes(lang)) {
                newLangsResponses[lang] = [...(newLangsResponses[lang] || []), key];
                newLanguages.add(lang);
            }

            const valueIndex = values.findIndex(v => v.lang === lang);
            if (valueIndex > -1) {
                values[valueIndex].sequence = [
                    ...values[valueIndex].sequence,
                    { content },
                ];
            } else {
                values.push({ lang, sequence: [{ content }] });
            }
        });
        if (values.length) {
            responses.push({
                ...(firstMetadataFound ? { metadata: firstMetadataFound } : {}),
                values,
                key,
            });
            responsesRasaFormat = { [key]: response, ...responsesRasaFormat };
        }
    });
    if (Object.keys(newLangsResponses).length > 0) {
        Object.keys(newLangsResponses).forEach((lang) => {
            warnings.push({
                text: `those reponses will add the support for the language ${lang} :`,
                longText: newLangsResponses[lang].join(', '),
            });
        });
    }

    Object.keys(slotsFromFile || {}).forEach((name) => {
        const slot = slotsFromFile[name];
        const options = {};
        if (slot.min_value) options.minValue = slot.min_value;
        if (slot.max_value) options.maxValue = slot.max_value;
        if (slot.initial_value) options.initialValue = slot.initial_value;
        if (slot.values) options.categories = slot.values;
        slots.push({
            name,
            type: slot.type,
            ...options,
        });
    });

    const actionsWithoutResponses = actionsFromFile.filter(
        action => !/^utter_/.test(action),
    );
    const actionNotInFragments = actionsWithoutResponses.filter(
        action => !actionsFromFragments.includes(action),
    );

    if (actionNotInFragments && actionNotInFragments.length > 0 && !isDefaultDomain) {
        warnings.push({
            text:
                'Some actions in domain are not explicitly mentioned in dialogue fragments.',
            longText: 'They will be added to the project\'s default domain.',
        });
    }
    const newDomain = {
        slots: isDefaultDomain ? slotsFromFile : slots,
        bfForms,
        responses: isDefaultDomain ? responsesRasaFormat : responses,
        actions: isDefaultDomain ? actionsWithoutResponses : actionNotInFragments,
        forms: formsFromFile,
    };

    return {
        ...file,
        warnings: [...(file?.warnings || []), ...warnings],
        ...newDomain,
        newLanguages: Array.from(newLanguages),
    };
};

export const validateDefaultDomains = (files, params) => {
    const { projectId, wipeProject, wipeInvolvedCollections } = params;
    let defaultDomain = {};
    let defaultDomainFiles = files.filter(file => file?.dataType === 'defaultdomain');
    defaultDomainFiles = defaultDomainFiles.map(domainFile => validateADomain(domainFile, params, true));

    if (defaultDomainFiles.length > 1) {
        let firstValidFileFound = false;
        defaultDomainFiles = defaultDomainFiles.map((domainFile) => {
            // we add warnings to all the files that valid except the first one
            if (
                !firstValidFileFound
                && !(domainFile.errors && domainFile.errors.length > 0)
            ) {
                firstValidFileFound = true;
                return domainFile;
            }
            if (domainFile.errors && domainFile.errors.length > 0) {
                return domainFile; // we don't add warnings to files with errors already
            }
            return {
                ...domainFile,
                warnings: [
                    ...(domainFile?.warnings || []),
                    'You have multiple domain files. In case of a conflict, data from first file will prevail.',
                ],
            };
        });
    }

    const defaultDomainValidFiles = onlyValidFiles(defaultDomainFiles);

    if (
        (wipeProject || wipeInvolvedCollections)
        && defaultDomainValidFiles.length === 0
    ) {
        const {
            settings: {
                private: { defaultDefaultDomain },
            },
        } = GlobalSettings.findOne(
            {},
            { fields: { 'settings.private.defaultDefaultDomain': 1 } },
        );

        defaultDomain = defaultDefaultDomain;
    } else if (defaultDomainValidFiles.length === 0) {
        defaultDomain = safeLoad(
            Projects.findOne({ _id: projectId }).defaultDomain.content,
        );
    } else {
        defaultDomain = mergeDefaultDomains(defaultDomainValidFiles);
    }
    const newSummary = params.summary || [];

    if (defaultDomainValidFiles.length > 0) {
        const nameList = defaultDomainValidFiles.map(file => file.filename).join(', ');
        newSummary.push(`The default domain will be replaced by ${nameList}.`);
    }
    const newFiles = files.map((file) => {
        if (file?.dataType !== 'defaultdomain') return file;
        return defaultDomainFiles.shift();
    });
    return [newFiles, { ...params, defaultDomain, summary: newSummary }];
};

export const validateDomain = (files, params) => {
    let domainFiles = files.filter(file => file?.dataType === 'domain');
    domainFiles = domainFiles.map(domainFile => validateADomain(domainFile, params));
    if (domainFiles.length > 1) {
        let firstValidFileFound = false;
        domainFiles = domainFiles.map((domainFile) => {
            // we add warnings to all the files that valid except the first one
            if (
                !firstValidFileFound
                && !(domainFile.errors && domainFile.errors.length > 0)
            ) {
                firstValidFileFound = true;
                return domainFile;
            }
            if (domainFile.errors && domainFile.errors.length > 0) {
                return domainFile; // we don't add warnings to files with errors already
            }
            return {
                ...domainFile,
                warnings: [
                    ...(domainFile?.warnings || []),
                    'You have multiple domain files. In case of a conflict, data from first file will prevail.',
                ],
            };
        });
    }

    const newSummary = params.summary;
    let newLanguages = params.projectLanguages;
    const existingStoryGroups = [...(params.existingStoryGroups || [])];
    const storyGroupsUsed = [...(params.storyGroupsUsed || [])];
    if (domainFiles.length > 0) {
        const newLangs = domainFiles.reduce(
            (all, file) => Array.from(new Set([...(file.newLanguages || []), ...all])),
            [],
        );
        const merged = mergeDomains(domainFiles);
        const nameList = domainFiles.map(file => file.filename).join(', ');
        merged.bfForms.forEach(({ groupName }) => {
            if (!existingStoryGroups.some(({ name }) => name === groupName)) {
                const newGroup = { name: groupName, _id: uuidv4() };
                existingStoryGroups.push(newGroup);
                storyGroupsUsed.push(newGroup);
                newSummary.push({
                    text: `Fragment group '${groupName}' will be created.`,
                });
            }
        });
        const slotsLen = merged.slots.length;
        const responsesLen = merged.responses.length;
        const formsLen = Object.keys(merged.forms).length + merged.bfForms.length;
        const actionsLen = merged.actions.length;
        const tempSummary = [];
        if (slotsLen > 0) tempSummary.push(`${slotsLen} slots`);
        if (responsesLen > 0) tempSummary.push(`${responsesLen} responses`);
        if (formsLen > 0) tempSummary.push(`${formsLen} forms`);
        if (actionsLen > 0) tempSummary.push(`${actionsLen} actions`);
        newSummary.push(
            ...newLangs.map(
                lang => `Support for language '${lang}' will be added using the default config.`,
            ),
        );
        if (tempSummary.length) {
            newSummary.push(`${tempSummary.join(', ')} will be added from ${nameList}.`);
        }
        newLanguages = Array.from(new Set([...params.projectLanguages, ...newLangs]));
    }
    return [
        files.map((file) => {
            if (file?.dataType !== 'domain') return file;
            return domainFiles.shift();
        }),
        {
            ...params,
            summary: newSummary,
            projectLanguages: newLanguages,
            existingStoryGroups,
            storyGroupsUsed,
        },
    ];
};
