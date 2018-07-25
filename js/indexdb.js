'use strict';

const idb = require('idb');

class IndexController {

  static openDatabase() {
    if (!navigator.serviceWorker) {
      return Promise.resolve();
    }

    return idb.open('restaurant-review', 1, (upgradeDb) => {
      const store = upgradeDb.createObjectStore('restaurants', {
        keyPath: 'id'
      });
      store.createIndex('by-date', 'updatedAt');
    });
  }

}

module.exports = IndexController;