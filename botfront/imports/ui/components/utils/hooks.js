import ResizeObserver from 'resize-observer-polyfill';
import { useRef, useEffect, useState } from 'react';
import { useQuery } from '@apollo/react-hooks';

export const useImperativeQuery = (query, variables) => {
    const { refetch } = useQuery(query, { skip: true, variables });
    const imperativelyCallQuery = vars => refetch(vars);
    return imperativelyCallQuery;
};

export function useEventListener(eventName, handler, element = window) {
    // https://usehooks.com/useEventListener/
    
    const savedHandler = useRef();

    // Update ref.current value if handler changes.
    // This allows our effect below to always get latest handler ...
    // ... without us needing to pass it in effect deps array ...
    // ... and potentially cause effect to re-run every render.
    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);
    useEffect(
        () => {
            // Make sure element supports addEventListener
            const isSupported = element && element.addEventListener;
            let cleanUpFunc = () => {};
            if (isSupported) {
                // Create event listener that calls handler function stored in ref
                const eventListener = event => savedHandler.current(event);
                // Add event listener
                element.addEventListener(eventName, eventListener);
                // Remove event listener on cleanup
                cleanUpFunc = () => element.removeEventListener(eventName, eventListener);
            }
            return cleanUpFunc;
        },
        [eventName, element], // Re-run if eventName or element changes
    );
}

export function useResizeObserver(handler, element) {
    const savedHandler = useRef();
    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);
    useEffect(() => {
        const isSupported = element && element instanceof HTMLElement;
        let cleanUpFunc = () => {};
        if (isSupported) {
            const resizeObserver = new ResizeObserver(savedHandler.current);
            resizeObserver.observe(element);
            cleanUpFunc = () => resizeObserver.unobserve(element);
        }
        return cleanUpFunc;
    }, [element]);
}

export const useIsMount = () => {
    const isMountRef = useRef(false);
    useEffect(() => {
        isMountRef.current = true;
    }, []);
    return isMountRef.current;
};

export function useMethod(methodName, { transform } = {}) {
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const call = (...args) => {
        setIsLoading(true);
        return new Promise((resolve, reject) => {
            Meteor.call(methodName, ...args, (err, result) => {
                if (err) {
                    setError(err);
                    reject(err);
                } else {
                    setData(transform ? transform(result) : result);
                    resolve(result);
                }
                setIsLoading(false);
            });
        });
    };

    return {
        isLoading, data, error, call,
    };
}
