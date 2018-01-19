'use strict';
const _ = require('lodash');
const State = require('../state');
const find = require('./find-func').find;
const ActionsBuilder = require('./actions-builder');

// Check if selector is not a string or not an object with "every" option.
const isNotValidSelector = (arg) => {
    return !(_.isString(arg) || (_.isObject(arg) && _.isString(arg.every)));
};

const isArrayOfStringsAndRegExps = (arr) => {
    return _.every(arr, (item) => _.isString(item) || _.isRegExp(item));
};

const createMatcher = (matchers, opts = {}) => {
    const newMatcher = (matcher) => {
        const resultMatcher = _.isRegExp(matcher) ? matcher.test.bind(matcher) : _.isEqual.bind(null, matcher);
        return opts.negate ? _.negate(resultMatcher) : resultMatcher;
    };

    if (!_.isArray(matchers)) {
        return newMatcher(matchers);
    }

    matchers = matchers.map(newMatcher);
    const predicate = opts.negate ? _.every : _.some;
    return (browserId) => predicate(matchers, (match) => match(browserId));
};

module.exports = function(suite) {
    this.setCaptureElements = (...args) => {
        const selectors = _.flatten(args);

        if (selectors.some(_.negate(_.isString))) {
            throw new TypeError('suite.captureElements accepts only strings or array of strings');
        }

        suite.captureSelectors = selectors;
        return this;
    };

    this.before = (hook) => {
        if (typeof hook !== 'function') {
            throw new TypeError('before hook must be a function');
        }

        suite.beforeActions = _.clone(suite.beforeActions);
        hook.call(suite.context, ActionsBuilder.create(suite.beforeActions), find);

        return this;
    };

    this.after = (hook) => {
        if (typeof hook !== 'function') {
            throw new TypeError('after hook must be a function');
        }

        const actions = [];
        hook.call(suite.context, ActionsBuilder.create(actions), find);
        suite.afterActions = actions.concat(suite.afterActions);

        return this;
    };

    this.setUrl = (url) => {
        if (typeof url !== 'string') {
            throw new TypeError('URL must be string');
        }
        suite.url = url;
        return this;
    };

    this.setTolerance = (tolerance) => {
        if (typeof tolerance !== 'number') {
            throw new TypeError('tolerance must be number');
        }
        suite.tolerance = tolerance;
        return this;
    };

    this.capture = (name, opts, cb) => {
        if (typeof name !== 'string') {
            throw new TypeError('State name should be string');
        }

        if (!cb) {
            cb = opts;
            opts = null;
        }

        cb = cb || _.noop;
        opts = opts || {};

        if (typeof cb !== 'function') {
            throw new TypeError('Second argument of suite.capture must be a function');
        }

        if (suite.hasStateNamed(name)) {
            throw new Error('State "' + name + '" already exists in suite "' + suite.name + '". ' +
                'Choose different name');
        }

        const state = new State(suite, name);
        cb.call(suite.context, ActionsBuilder.create(state.actions), find);

        if ('tolerance' in opts) {
            if (typeof opts.tolerance !== 'number') {
                throw new TypeError('Tolerance should be number');
            }
            state.tolerance = opts.tolerance;
        }
        suite.addState(state);
        return this;
    };

    this.ignoreElements = (...args) => {
        const selectors = _.flatten(args);

        if (selectors.some(isNotValidSelector)) {
            throw new TypeError('suite.ignoreElements accepts strings, object with property "every" as string or array of them');
        }
        suite.ignoreSelectors = selectors;
        return this;
    };

    const saveSkipped = (browser, comment, opts = {}) => {
        if (!isArrayOfStringsAndRegExps(_.isArray(browser) ? browser : [browser])) {
            throw new TypeError('Browser must be string or RegExp object');
        }

        suite.skip({matches: createMatcher(browser, opts), comment});
    };

    this.skip = (browser, comment) => {
        if (!browser) {
            suite.skip();
        } else {
            saveSkipped(browser, comment);
        }
        return this;
    };

    this.skip.in = this.skip;

    this.skip.notIn = (browser, comment) => {
        if (browser) {
            saveSkipped(browser, comment, {negate: true});
        }
        return this;
    };

    const saveBrowsers = (matchers, opts = {}) => {
        matchers = _.flatten(matchers);
        if (matchers.length === 0 || !isArrayOfStringsAndRegExps(matchers)) {
            throw new TypeError('suite.browsers must be string or RegExp object');
        }

        suite.browsers = suite.browsers.filter(createMatcher(matchers, opts));
        return this;
    };

    this.browsers = (...matchers) => saveBrowsers(matchers);

    this.only = {
        in: this.browsers,
        notIn: (...matchers) => saveBrowsers(matchers, {negate: true})
    };
};
