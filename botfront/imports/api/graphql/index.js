import { mergeTypeDefs } from '@graphql-tools/merge';
import gql from 'graphql-tag';
import conversationResolvers from './conversations/resolvers';
import conversationTypes from './conversations/schemas';
import activityResolver from './activity/resolvers/activityResolver';
import activityTypes from './activity/schemas';
import commonResolver from './common/commonResolver';
import commonTypes from './common/common.types.graphql';
import botResponsesResolvers from './botResponses/resolvers';
import botResponsesTypes from './botResponses/schemas';
import configResolver from './config/configResolver';
import configTypes from './config/config.types.graphql';
import formResolver from './forms/formResolver';
import formTypes from './forms/forms.types.graphql';
import storiesTypes from './story/schemas/stories.types.graphql';
import storiesResolver from './story/resolvers/storiesResolver';
import rolesDataTypes from './rolesData/schemas';
import rolesDataResolver from './rolesData/resolvers/rolesDataResolver';
import trackerStoreResolver from './trackerStore/resolvers/trackerStoreResolver';
import trackerStoreTypes from './trackerStore/schemas';
import analyticsDashboardResolver from './analyticsDashboards/analyticsDashboardResolver';
import analyticsDashboardTypes from './analyticsDashboards/analyticsDashboards.types.graphql';
import examplesResolver from './examples/resolvers/examplesResolver';
import examplesTypes from './examples/schemas';
import projectResolver from './project/projectResolver';
import projectTypes from './project/project.types.graphql';

export const resolvers = [
    ...conversationResolvers,
    ...botResponsesResolvers,
    rolesDataResolver,
    activityResolver,
    commonResolver,
    configResolver,
    formResolver,
    storiesResolver,
    trackerStoreResolver,
    analyticsDashboardResolver,
    examplesResolver,
    projectResolver,
];

const typeList = [
    ...conversationTypes,
    ...botResponsesTypes,
    ...activityTypes,
    ...rolesDataTypes,
    ...trackerStoreTypes,
    ...examplesTypes,
    commonTypes,
    configTypes,
    formTypes,
    storiesTypes,
    analyticsDashboardTypes,
    projectTypes,
];

export const typeDefs = mergeTypeDefs(typeList, { all: true });

export const typeDefsWithUpload = mergeTypeDefs(
    [
        ...typeList,
        gql`scalar Upload`,
    ],
    { all: true },
);

export const schemaDirectives = {};
