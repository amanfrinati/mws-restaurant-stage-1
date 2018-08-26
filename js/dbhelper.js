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
      let store = upgradeDb.createObjectStore('restaurants', {
        keyPath: 'id'
      });
      store.createIndex('cuisine', 'cuisine_type');
      store.createIndex('neighborhood', 'neighborhood');

      store = upgradeDb.createObjectStore('reviews', {
        keyPath: 'id'
      });
      store.createIndex('byRestaurant', 'restaurant_id');

      store = upgradeDb.createObjectStore('reviews-misaligned', {
        keyPath: 'id'
      });
      store.createIndex('byRestaurant', 'restaurant_id');
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

  /**
   * Fetch restaurant info from the server and cache on the DB
   * @param {*} id of restaurant to fetch
   */
  static fetchAndCacheRestaurants(id) {
    return fetch(`${DBHelper.BASE_URL}/restaurants/${id ? id : ''}`)
      .then(res => res.json())
      .then(async restaurants => {
        const db = await DBHelper.dbPromise();
        const tx = db.transaction('restaurants', 'readwrite');
        const store = tx.objectStore('restaurants');
        restaurants.forEach((entry) => store.put(entry));
        await tx.complete;
        return restaurants;
      })
      .catch(err => console.error(`Oh no! Somethind went wrong! ${err}`, null));
  }

  static fetchAndCacheReviews(id) {
    return this.dbPromise().then(db => {
      if (!db) return;

      const tx = db.transaction('reviews-misaligned');
      return tx.objectStore('reviews-misaligned').openCursor();
    }).then(function fetchReview(cursor) {
      if(!cursor) return;
      console.log("Cursored at:", cursor.value);
      // I could also do things like:
      // cursor.update(newValue) to change the value, or
      // cursor.delete() to delete this entry
      return cursor.continue().then(fetchReview);

    }).then(() => {
      return fetch(`${DBHelper.BASE_URL}/reviews/${id ? '?restaurant_id=' + id : ''}`)
        .then(res => res.json())
        .then(async reviews => {
          console.log('via di cache');

          const db = await DBHelper.dbPromise();
          const tx = db.transaction('reviews', 'readwrite');
          const store = tx.objectStore('reviews');
          reviews.forEach(entry => store.put(entry));
          await tx.complete;
          console.log('reviews', reviews);
          return reviews;
        })
        .catch(err => console.error(`Oh no! Somethind went wrong! ${err}`, null));
    });
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants() {
    return DBHelper.dbPromise()
      .then(db => {
        if (!db) {
          return Promise.reject('An error occours while opening DB!');
        }
        return db.transaction('restaurants')
          .objectStore('restaurants').getAll();
      })
      .then(data => {
        if (data && data.length > 0) {
          return Promise.resolve(data);
        } else {
          return DBHelper.fetchAndCacheRestaurants()
            .then(data => Promise.resolve(data))
            .catch(err => Promise.reject(`Oh no! Somethind went wrong! ${err}`));
        }
      }).catch(err => console.error(err));
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id) {
    return DBHelper.dbPromise().then(db => {
      if (!db) {
        return Promise.reject('Database error');
      }

      const tx = db.transaction('restaurants');
      const restaurantsStore = tx.objectStore('restaurants');
      return restaurantsStore.get(+id);
    }).then(data => {
      if (data) {
        return Promise.resolve(data);
      } else {
        DBHelper.fetchAndCacheRestaurants(id)
          .then(data => Promise.resolve(data))
          .catch(err => Promise.reject(`Oh no! An error occours fetching restaurant with ID ${id}. ${err}`));
      }
    }).catch(err => Promise.reject(`Oh no! Somethings went wrong! ${err}`));
  }

  static async fetchReviewsByRestaurantId(id) {
    await DBHelper.fetchAndCacheReviews(id);
    return DBHelper.dbPromise().then(db => {
      if (!db) {
        return Promise.reject('Database error');
      }

      const tx = db.transaction('reviews')
        .objectStore('reviews').index('byRestaurant');
      return tx.getAll(id);
    }).catch(err => Promise.reject(`Oh no! Somethings went wrong! ${err}`));
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
    DBHelper.fetchRestaurants()
      .then(restaurants => {
        let results = restaurants;
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }).catch(error => callback(error, null))
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants()
      .then(restaurants => {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);
        callback(null, uniqueNeighborhoods);
      }).catch(error => callback(error, null));
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants()
      .then(restaurants => {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
        callback(null, uniqueCuisines);
      }).catch(error => callback(error, null));
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

  static addReview(review) {
    /* {
      'restaurant_id': self.restaurant.id,
      'name': reviewer_name,
      'rating': rating,
      'comments': comment_text
    } */

    return fetch(`${DBHelper.BASE_URL}/reviews/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(review)
    }).then(response => response.status);
  }
}

module.exports = DBHelper;
