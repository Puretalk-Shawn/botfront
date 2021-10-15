import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'semantic-ui-react';

const { version } = require('/package.json');

// eslint-disable-next-line no-useless-concat
const URL_WITH_BODY_TEMPLATE = 'https://github.com/botfront/botfront/issues/new?labels=bug&template=bug_report.md&body='
    + `
**Describe the bug**
Here is the report:

\`\`\`
{{error}}
\`\`\`

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Desktop (please complete the following information):**
 - OS: [e.g. iOS]
 - Browser [e.g. chrome, safari]
 - Version [e.g. 22]

**Smartphone (please complete the following information):**
 - Device: [e.g. iPhone6]
 - OS: [e.g. iOS8.1]
 - Browser [e.g. stock browser, safari]
 - Version [e.g. 22]

**Additional context**
Add any other context about the problem here.
`;

const CrashReportButton = (props) => {
    const {
        error, pathname: path, setReported, reported,
    } = props;

    /*  https://reactjs.org/blog/2020/08/10/react-v17-rc.html#native-component-stacks
        Until React 17, componentStack will be unhelpful in production. Best we can do
        is make sure top JS error location is dumped, as that one can be decoded using
        source map. This error location is first line of stack in dev, but second line
        is production, so we include first two lines.
    */
    const generateReport = (text = true) => {
        const [err, info] = error;
        const firstTwoLinesOfStack = err.stack ? err.stack.split('\n').slice(0, 2).join('\n    in ') : 'stack not available';
        if (text) {
            return (
                `Version: ${version}\n`
                + `${path ? `Path: ${path}\n` : ''}`
                + 'Info:\n'
                + `${err.toString()}\n    in ${firstTwoLinesOfStack}`
                + `${info.componentStack || ''}`
            );
        }
        return {
            version,
            path,
            error: err.toString().replace(/\n/g, ' '),
            trace:
                (`${firstTwoLinesOfStack}${info.componentStack || ''}`)
                    .replace(/\n\s{3,4}in\s/g, ' >> ')
                    .split(' >> '),
        };
    };

    useEffect(
        () => Meteor.call('reportCrash', generateReport(false), (_, res) => {
            if (res.reported) setReported(res.reported);
        }),
        [],
    );

    const sendCrashReport = () => {
        const newWindow = window.open(
            URL_WITH_BODY_TEMPLATE.replace('{{error}}', generateReport()).replace(
                /\n/g,
                '%0A',
            ), '_blank',
        );
        newWindow.focus();
    };

    const copyToClipboard = () => {
        const dummy = document.createElement('textarea');
        document.body.appendChild(dummy);
        dummy.value = generateReport();
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
    };

    if (reported) return null;
    return (
        <Button.Group fluid basic>
            <Button
                content='Report issue'
                onClick={sendCrashReport}
            />
            <Button
                content='Copy to clipboard'
                onClick={copyToClipboard}
            />
        </Button.Group>
    );
};

CrashReportButton.propTypes = {
    error: PropTypes.array.isRequired,
    pathname: PropTypes.string,
    reported: PropTypes.bool,
    setReported: PropTypes.func,
};

CrashReportButton.defaultProps = {
    pathname: null,
    reported: false,
    setReported: () => {},
};

export default CrashReportButton;
