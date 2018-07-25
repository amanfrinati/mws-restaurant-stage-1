'use strict';

const idb = require('idb');

/**
 * Open a connection to the IndexedDb and create relative index
 */
function openDatabase() {
  if (!navigator.serviceWorker) {
    return Promise.resolve();
  }

  return idb.open('restaurant-reviews', 1, (upgradeDb) => {
    const store = upgradeDb.createObjectStore('restaurants', {
      keyPath: 'id'
    });
    store.createIndex('cuisine', 'cuisine_type');
    store.createIndex('neighborhood', 'neighborhood');
  });
}
const _dbPromise = openDatabase();

/**
 * Common database helper functions.
 */
class DBHelper {

  /**
   * The function puts the data received as param to the IndexedDb.
   * Data need be an Array
   *
   * @param {Array(any)} data
   */
  static fillDb(data) {
    return _dbPromise.then(function (db) {
      if (!db) return;

      var tx = db.transaction('restaurants', 'readwrite');
      var store = tx.objectStore('restaurants');
      data.forEach((entry) => store.put(entry));
      return tx.complete;
    });
  }

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}/restaurants`;
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {

    _dbPromise.then((db) => {
      if (!db) return;

      const tx = db.transaction('restaurants');
      const restaurantsStore = tx.objectStore('restaurants');
      return restaurantsStore.getAll();

    }).then((data) => {
      if (data && data.length > 0) {
        callback(null, data);
      } else {
        fetch(`${DBHelper.DATABASE_URL}`) // Open the database
          .then(res => res.json())
          .then(data => DBHelper.fillDb(data)) //Fill the DB
          .then(DBHelper.fetchRestaurants(callback))
          .catch(err => callback(`Oh no! Somethind went wrong! ${err}`, null));
      }
    });
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {

    _dbPromise.then((db) => {
      if (!db) return;

      const tx = db.transaction('restaurants');
      const restaurantsStore = tx.objectStore('restaurants');
      return restaurantsStore.get(+id);
    }).then((data) => {
      if (data) {
        callback(null, data);
      } else {
        fetch(`${DBHelper.DATABASE_URL}/${id}`)
          .then(res => res.json())
          .then(data => DBHelper.fillDb([data]))
          .then(DBHelper.fetchRestaurantById(id, callback))
          .catch(err => callback(`Oh no! Somethind went wrong! ${err}`, null));
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   * @returns array of restaurants with cuisine === `cuisine`
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants with proper error handling
    _dbPromise.then((db) => {
      if (!db) return;

      const tx = db.transaction('restaurants');
      const restaurantsStore = tx.objectStore('restaurants');
      const cuisineIndex = restaurantsStore.index('cuisine');
      return cuisineIndex.getAll(cuisine);

    }).then(data => callback(null, data))
      .catch(err => callback(err, null));
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   * @returns array of restaurants with neighborhood === `neighborhood`
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    _dbPromise.then((db) => {
      if (!db) return;

      const tx = db.transaction('restaurants');
      const restaurantsStore = tx.objectStore('restaurants');
      const neighborhoodIndex = restaurantsStore.index('neighborhood');
      return neighborhoodIndex.getAll(neighborhood);

    }).then(data => callback(null, data))
      .catch(err => callback(err, null));
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants;
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    // Get the filename and extension
    const [filename, extension] = restaurant.photograph.split('.');
    return `/images/${filename}-320_small.${extension || 'jpg'}`;
  }

  /**
   * Restaurant image srcset URLs.
   */
  static imageSrcsetForRestaurant(restaurant) {
    // Get the filename
    const [filename, extension] = restaurant.photograph.split('.');
    return (`/images/${filename}-320_small.${extension || 'jpg'} 320w,
             /images/${filename}-640_medium.${extension || 'jpg'} 640w,
             /images/${filename}-800_large.${extension || 'jpg'} 800w`);
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    return new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP
    });
  }
}

module.exports = DBHelper;
