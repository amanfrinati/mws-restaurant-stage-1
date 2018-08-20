'use strict';

const idb = require('idb');

/**
 * Common database helper functions.
 */
class DBHelper {

  /**
   * Open a connection to the IndexedDb and create relative index
   */
  static dbPromise() {
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

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get BASE_URL() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}`;
  }

  static fetchAndCacheRestaurants(id) {
    const URL = `${DBHelper.BASE_URL}/restaurants/${id ? id : ''}`;

    return fetch(URL)
      .then(res => res.json())
      .then(async restaurants => {
        const db = await DBHelper.dbPromise();
        const tx = db.transaction('restaurants', 'readwrite');
        const store = tx.objectStore('restaurants');
        // restaurants.forEach(store.put.bind(store));
        restaurants.forEach((entry) => store.put(entry));
        await tx.complete;
        return restaurants;
      })
      .catch(err => console.error(`Oh no! Somethind went wrong! ${err}`, null));
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
    DBHelper.dbPromise()
      .then((db) => {
        if (!db) return;

        const tx = db.transaction('restaurants');
        const restaurantsStore = tx.objectStore('restaurants');
        return restaurantsStore.getAll();
      })
      .then((data) => {
        if (data && data.length > 0) {
          callback(null, data);
        } else {
          DBHelper.fetchAndCacheRestaurants()
            .then(data => callback(null, data))
            .catch(err => callback(`Oh no! Somethind went wrong! ${err}`, null));
        }
      });
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    DBHelper.dbPromise().then((db) => {
      if (!db) return;

      const tx = db.transaction('restaurants');
      const restaurantsStore = tx.objectStore('restaurants');
      return restaurantsStore.get(+id);
    }).then((data) => {
      if (data) {
        callback(null, data);
      } else {
        DBHelper.fetchAndCacheRestaurants(id)
          .then(data => callback(null, data))
          .catch(err => callback(`Oh no! Somethind went wrong! ${err}`, null));
        // return fetch(`${DBHelper.BASE_URL}/restaurants/${id}`)
        //   .then(res => res.json())
        //   .then(async restaurant => {
        //     const db = await DBHelper.dbPromise();
        //     const tx = db.transaction('restaurants', 'readwrite');
        //     const store = tx.objectStore('restaurants');
        //     store.put(restaurant);
        //     await tx.complete;
        //     return restaurant;
        //   })
        //   .catch(err => callback(`Oh no! Somethind went wrong! ${err}`, null));
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   * @returns array of restaurants with cuisine === `cuisine`
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants with proper error handling
    DBHelper.dbPromise().then((db) => {
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
    DBHelper.dbPromise().then((db) => {
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

  /**
   * @returns true if @param restaurant is favorite
   */
  static isFavoriteRestaurant(restaurant) {
    return restaurant.is_favorite;
  }
}

module.exports = DBHelper;
