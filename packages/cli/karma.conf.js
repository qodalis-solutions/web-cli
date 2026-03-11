const { createRequire } = require('module');
const path = require('path');
const workspaceRootRequire = createRequire(path.join(__dirname, '../../') + '/');

// Patch karma-chrome-launcher to add --no-sandbox before it registers the browser
const chromeLauncher = workspaceRootRequire('karma-chrome-launcher');
const origHeadlessGetOptions = chromeLauncher.headlessGetOptions;
if (origHeadlessGetOptions) {
    chromeLauncher.headlessGetOptions = function (url, args, parent) {
        const opts = origHeadlessGetOptions.call(this, url, args, parent);
        if (!opts.includes('--no-sandbox')) {
            const urlIndex = opts.findIndex((o) => o === url);
            if (urlIndex > -1) {
                opts.splice(urlIndex, 0, '--no-sandbox');
            } else {
                opts.push('--no-sandbox');
            }
        }
        return opts;
    };
}

module.exports = function (config) {
    config.set({
        basePath: '',
        frameworks: ['jasmine', '@angular-devkit/build-angular'],
        plugins: [
            'karma-jasmine',
            'karma-chrome-launcher',
            'karma-jasmine-html-reporter',
            'karma-coverage',
            '@angular-devkit/build-angular/plugins/karma',
        ].map((p) => workspaceRootRequire(p)),
        client: {
            clearContext: false,
        },
        coverageReporter: {
            dir: path.join(__dirname, '../../coverage/cli'),
            subdir: '.',
            reporters: [{ type: 'html' }, { type: 'text-summary' }],
        },
        reporters: ['progress', 'kjhtml'],
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        autoWatch: true,
        browsers: ['ChromeHeadless'],
        singleRun: false,
        restartOnFileChange: true,
    });
};
