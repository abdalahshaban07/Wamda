"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORAGE_KEY = void 0;
exports.fresh = fresh;
exports.parseState = parseState;
exports.readState = readState;
exports.writeState = writeState;
const catalog_1 = require("./catalog");
exports.STORAGE_KEY = 'cofeed.local.v1';
function fresh() {
    return {
        version: 1,
        lang: 'ar',
        likes: [],
        saved: {},
        collections: [{ id: 'inbox', name: 'Inbox' }],
    };
}
function parseState(input) {
    if (input.length > 200000)
        throw new Error('size');
    const x = JSON.parse(input);
    if (!x || typeof x !== 'object' || Array.isArray(x))
        throw new Error('shape');
    const a = x;
    if (a['version'] !== 1 ||
        !['ar', 'en'].includes(a['lang']) ||
        !Array.isArray(a['collections']) ||
        a['collections'].length < 1 ||
        a['collections'].length > 30 ||
        !Array.isArray(a['likes']) ||
        !a['saved'] ||
        typeof a['saved'] !== 'object' ||
        Array.isArray(a['saved']))
        throw new Error('shape');
    const collections = a['collections'].map((v) => {
        if (!v || typeof v !== 'object' || Array.isArray(v))
            throw new Error('collection');
        const c = v;
        if (typeof c['id'] !== 'string' ||
            !/^[-a-zA-Z0-9_]{1,80}$/.test(c['id']) ||
            typeof c['name'] !== 'string' ||
            !c['name'].trim() ||
            c['name'].trim().length > 40)
            throw new Error('collection');
        return { id: c['id'], name: c['name'].trim() };
    });
    if (new Set(collections.map((c) => c.id)).size !== collections.length ||
        new Set(collections.map((c) => c.name.toLocaleLowerCase())).size !==
            collections.length ||
        !collections.some((c) => c.id === 'inbox'))
        throw new Error('duplicate');
    const ids = new Set(catalog_1.catalog.map((p) => p.id));
    const likes = a['likes'];
    if (likes.length > ids.size ||
        likes.some((v) => typeof v !== 'string' || !ids.has(v)) ||
        new Set(likes).size !== likes.length)
        throw new Error('likes');
    const saved = {};
    for (const [k, v] of Object.entries(a['saved'])) {
        if (!ids.has(k) ||
            typeof v !== 'string' ||
            !collections.some((c) => c.id === v))
            throw new Error('saved');
        saved[k] = v;
    }
    return {
        version: 1,
        lang: a['lang'],
        likes: likes,
        collections,
        saved,
    };
}
function readState(storage) {
    let raw = null;
    try {
        raw = storage.getItem(exports.STORAGE_KEY);
    }
    catch {
        return { state: fresh(), issue: 'unavailable', raw: null };
    }
    if (raw === null)
        return { state: fresh(), issue: 'none', raw: null };
    try {
        return { state: parseState(raw), issue: 'none', raw };
    }
    catch {
        return { state: fresh(), issue: 'corrupt', raw };
    }
}
function writeState(storage, state) {
    try {
        storage.setItem(exports.STORAGE_KEY, JSON.stringify(state));
        return true;
    }
    catch {
        return false;
    }
}
