class StorageLocator {
    constructor(uri) {
        if (!uri || typeof uri !== 'string') throw new Error('Storage URI inválida');
        this.uri = uri;
        Object.freeze(this);
    }
}
module.exports = StorageLocator;
