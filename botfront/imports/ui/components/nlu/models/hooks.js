import { useQuery, useMutation, useSubscription } from '@apollo/react-hooks';
import { useImperativeQuery } from '../../utils/hooks';
import {
    GET_EXAMPLES,
    LIST_INTENTS_AND_ENTITIES,
    INTENTS_OR_ENTITIES_CHANGED,
    INSERT_EXAMPLES,
    DELETE_EXAMPLES,
    UPDATE_EXAMPLES,
    SWITCH_CANONICAL,
} from './graphql.js';
import { can } from '../../../../lib/scopes';

export const useLazyExamples = (variables) => {
    const getExamples = useImperativeQuery(GET_EXAMPLES, { ...variables, pageSize: -1 });
    return async (vars) => {
        const { data } = await getExamples(vars);
        return data.examples.examples || [];
    };
};

export function useExamples(variables) {
    const {
        data, loading, error, fetchMore, refetch,
    } = useQuery(GET_EXAMPLES, {
        notifyOnNetworkStatusChange: true, variables,
    });

    if (!data || !data.examples) return { loading, data: [] };
    const loadMore = () => fetchMore({
        query: GET_EXAMPLES,
        notifyOnNetworkStatusChange: true,
        variables: {
            ...variables,
            cursor: data.examples.pageInfo.endCursor,
        },
        updateQuery: (previousResult, { fetchMoreResult }) => {
            const { examples, pageInfo } = fetchMoreResult.examples;
            return examples.length
                ? {
                    examples: {
                        // eslint-disable-next-line no-underscore-dangle
                        __typename: previousResult.examples.__typename,
                        examples: [...previousResult.examples.examples, ...examples],
                        pageInfo,
                    },
                }
                : previousResult;
        },
    });

    return {
        data: data.examples.examples,
        hasNextPage: data.examples.pageInfo.hasNextPage,
        totalLength: data.examples.pageInfo.totalLength,
        loading,
        error,
        loadMore,
        refetch,
    };
}

export function useIntentAndEntityList(variables) {
    if (!can('nlu-data:r', variables.projectId)) {
        return {
            intents: [],
            entities: [],
            loading: false,
            error: null,
            refetch: () => {},
        };
    }
    const {
        data, loading, error, refetch,
    } = useQuery(LIST_INTENTS_AND_ENTITIES, {
        notifyOnNetworkStatusChange: true, variables,
    });
    useSubscription(INTENTS_OR_ENTITIES_CHANGED, {
        variables,
        onSubscriptionData: ({ subscriptionData: { data: subData } }) => {
            if (subData.intentsOrEntitiesChanged.changed) refetch(); // nothing fancy just recalculate all
        },
    });

    if (!data || !data.listIntentsAndEntities) return { loading };
    const { intents, entities } = data.listIntentsAndEntities;

    return {
        intents,
        entities,
        loading,
        error,
        refetch,
    };
}

export const useDeleteExamples = variables => useMutation(
    DELETE_EXAMPLES,
    {
        update: (cache, { data: { deleteExamples: deleted } }) => {
            const result = cache.readQuery({ query: GET_EXAMPLES, variables });
            const { examples: { examples } } = result;
            cache.writeQuery({
                query: GET_EXAMPLES,
                variables,
                data: {
                    ...result,
                    examples: {
                        ...result.examples,
                        examples: examples.filter(a => !deleted.includes(a._id)),
                    },
                },
            });
        },
    },
);


export const useSwitchCanonical = variables => useMutation(
    SWITCH_CANONICAL,
    {
        update: (cache, { data: { switchCanonical: updatedExamples } }) => {
            const updatedIds = updatedExamples.map(example => example._id);
            const result = cache.readQuery({ query: GET_EXAMPLES, variables });
            const { examples: { examples } } = result;
            const modifiedExamples = examples.map((example) => {
                const indexOfUpdated = updatedIds.indexOf(example._id);
                if (indexOfUpdated !== -1) {
                    return updatedExamples[indexOfUpdated];
                }
                return example;
            });
            cache.writeQuery({
                query: GET_EXAMPLES,
                variables,
                data: {
                    ...result,
                    examples: {
                        ...result.examples,
                        examples: modifiedExamples,
                    },
                },
            });
        },
    },
);

export const useInsertExamples = (variables, updateCache = true) => useMutation(
    INSERT_EXAMPLES,
    {
        variables,
        update: updateCache ? (cache, { data: { insertExamples: insertedExamples } }) => {
            const result = cache.readQuery({ query: GET_EXAMPLES, variables });
            const { examples: { examples } } = result;
            const newExamples = [...insertedExamples, ...examples];
            cache.writeQuery({
                query: GET_EXAMPLES,
                variables,
                data: {
                    ...result,
                    examples: {
                        ...result.examples,
                        examples: newExamples,
                    },
                },
            });
        } : undefined,
    },
);

export const useUpdateExamples = variables => useMutation(
    UPDATE_EXAMPLES,
    {
        variables,
        update: (cache, { data: { updateExamples: updatedExamples } }) => {
            const updatedIds = updatedExamples.map(ex => ex._id);
            const result = cache.readQuery({ query: GET_EXAMPLES, variables });
            const { examples: { examples } } = result;
            const modifiedExamples = examples.map((example) => {
                const indexOfUpdated = updatedIds.indexOf(example._id);
                if (indexOfUpdated !== -1) {
                    return updatedExamples[indexOfUpdated];
                }
                return example;
            });
            cache.writeQuery({
                query: GET_EXAMPLES,
                variables,
                data: {
                    ...result,
                    examples: {
                        ...result.examples,
                        examples: modifiedExamples,
                    },
                },
            });
        },
    },
);
