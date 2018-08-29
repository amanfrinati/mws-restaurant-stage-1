'use strict';

const idb = require('idb');

/**
 * Common database helper functions.
 */
class DBHelper {

  constructor() {
    this.dbPromise = this.openDatabase();
  }

  /**
   * Open a connection to the IndexedDb and create relative index
   */
  openDatabase() {
    if (!navigator.serviceWorker) {
      return Promise.resolve();
    }

    return idb.open('restaurant-reviews', 1, (upgradeDb) => {
      let store = upgradeDb.createObjectStore('restaurants', {
        keyPath: 'id'
      });
      store.createIndex('cuisine', 'cuisine_type');
      store.createIndex('neighborhood', 'neighborhood');
      store.createIndex('misaligned', 'misaligned');

      store = upgradeDb.createObjectStore('reviews', {
        keyPath: 'id'
      });
      store.createIndex('byRestaurant', 'restaurant_id');
      store.createIndex('misaligned', 'misaligned');
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
   * Fetch restaurant data from the server and cache to DB.
   * If id is not present, fetch all restaurants on DB.
   * @param {*} id of restaurant to fetch
   */
  fetchAndCacheRestaurants(id) {
    return this.dbPromise.then(db => {
      return db.transaction('restaurants')
        .objectStore('restaurants').index('misaligned').getAll();

    }).then(restaurants => {
      restaurants.forEach(restaurant => {
        delete restaurant.misaligned;
        this.updateFavorite(restaurant)
          .then(response => {
            // If misaligned is not present, the POST was executed!
            if (!response.misaligned) {

              // Remove the misaligned record
              // This record will push on next then()
              this.removeRestaurantFromCache(response);
            }
          });
      });
    }).then(() => {
      return fetch(`${DBHelper.BASE_URL}/restaurants/${id ? id : ''}`)
        .then(res => res.json())
        .then(restaurants => {
          return this.dbPromise.then(db => {
            const tx = db.transaction('restaurants', 'readwrite');
            const store = tx.objectStore('restaurants');

            // If id is not present, from BE return an array
            if (id) {
              store.put(restaurants);
            } else {
              restaurants.forEach(entry => store.put(entry));
            }
            return tx.complete;
          })
        })
        .catch(err => console.error(`Oh no! Somethind went wrong on fetchAndCacheRestaurants! ${err}`, null));
    })
  }

  /**
   * Fetch restaurant reviews from the server and cache to DB.
   * If id is not present, fetch all reviews on DB.
   * @param {*} id of restaurant to fetch
   */
  fetchAndCacheReviews(id) {
    return this.dbPromise.then(db => {
      return db.transaction('reviews')
        .objectStore('reviews').index('misaligned').getAll();

    }).then(reviews => {
      reviews.forEach(async review => {
        delete review.misaligned;
        await DBHelper.addReview(review)
          .then(response => {
            // If misaligned is not present, the POST was executed!
            if (!response.misaligned) {
              this.addReviewToCache(response);

              // Remove the misaligned record
              this.removeReviewFromCache(review);
            }
          });
      });
    }).then(() => {
      return fetch(`${DBHelper.BASE_URL}/reviews/${id ? '?restaurant_id=' + id : ''}`)
        .then(res => res.json())
        .then(async reviews => {
          const db = await this.dbPromise;
          const tx = db.transaction('reviews', 'readwrite');
          const store = tx.objectStore('reviews');
          reviews.forEach(entry => store.put(entry));
          await tx.complete;
          return reviews;
        })
        .catch(err => console.error(`Oh no! Somethind went wrong on fetchAndCacheReviews! ${err}`, null));
    });
  }

  /**
   * Fetch all restaurants.
   */
  async fetchRestaurants() {
    await this.fetchAndCacheRestaurants();
    return this.dbPromise.then(db => {
      const tx = db.transaction('restaurants')
        .objectStore('restaurants');
      const restaurants = tx.getAll();
      return restaurants;

    }).catch(err => Promise.reject(`Oh no! Somethind went wrong on fetchRestaurants! ${err}`));
  }

  /**
   * Get from DB the restaurant data
   * @param {*} id of restaurant to fetch
   */
  async fetchRestaurantById(id) {
    await this.fetchAndCacheRestaurants(id);
    return this.dbPromise.then(db => {
      const tx = db.transaction('restaurants')
        .objectStore('restaurants');
      return tx.get(+id);
    }).catch(err => Promise.reject(`Oh no! Somethings went wrong on fetchRestaurantById! ${err}`));
  }

  /**
   * Get from DB the restaurant reviewa
   * @param {*} id of restaurant to fetch
   */
  async fetchReviewsByRestaurantId(id) {
    await this.fetchAndCacheReviews(id);
    return this.dbPromise.then(db => {
      const tx = db.transaction('reviews')
        .objectStore('reviews').index('byRestaurant');
      return tx.getAll(id);
    }).catch(err => Promise.reject(`Oh no! Somethings went wrong! ${err}`));
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   * @returns array of restaurants with cuisine === `cuisine`
   */
  fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants with proper error handling
    this.dbPromise.then(db =>
      db.transaction('restaurants')
        .objectStore('restaurants').index('cuisine').getAll(cuisine)

    ).then(data => callback(null, data))
      .catch(err => callback(err, null));
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   * @returns array of restaurants with neighborhood === `neighborhood`
   */
  fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    this.dbPromise.then(db =>
      db.transaction('restaurants').objectStore('restaurants')
        .index('neighborhood').getAll(neighborhood)

    ).then(data => callback(null, data))
      .catch(err => callback(err, null));
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    this.fetchRestaurants()
      .then(restaurants => {
        let results = restaurants;
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }).catch(error => callback(error, null));
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  fetchNeighborhoods(callback) {
    // Fetch all restaurants
    this.fetchRestaurants()
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
  fetchCuisines(callback) {
    // Fetch all restaurants
    this.fetchRestaurants()
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
    return `./restaurant.html?id=${restaurant.id}`;
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
    if (!google) {
      return;
    }

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
    return JSON.parse(restaurant.is_favorite ? restaurant.is_favorite : false);
  }

  updateFavorite(restaurant) {
    const URL = `${DBHelper.BASE_URL}/restaurants/${restaurant.id}/?is_favorite=${DBHelper.isFavoriteRestaurant(restaurant)}`;
    return fetch(URL, {
      method: 'OPTIONS'
    }).then(response =>
      response.text()
    ).then(res => {
      if (!res.indexOf('PUT')) {
        return Promise.reject('PUT not admitted!');
      }

      return fetch(URL, {
        method: 'PUT',
      }).then(response => {
        if (response.ok) {
          return response.json()
        }
        return Promise.reject('PUT failed!');
      });
    }).catch(err => {
      console.error('addReview failed to fetch!', err);

      // Return an object with a random ID and a property to indicate that is misaligne
      return Promise.resolve({
        ...restaurant,
        is_favorite: DBHelper.isFavoriteRestaurant(restaurant),
        misaligned: 1
      });
    });
  }

  /**
   * Perform the new review POST to the BE
   * @param {*} review data
   * @returns {*} The new review created
   */
  static addReview(review) {
    /* {
        'restaurant_id': self.restaurant.id,
        'name': reviewer_name,
        'rating': rating,
        'comments': comment_text
    } */

    const URL = `${DBHelper.BASE_URL}/reviews/`;
    return fetch(URL, {
      method: 'OPTIONS',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      }
    }).then(response =>
      response.text()
    ).then(res => {
      if (!res.indexOf('POST')) {
        return Promise.reject('POST not admitted!');
      }

      return fetch(URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(review)
      }).then(response => {
        if (response.status === 201) {
          return response.json()
        }
        return Promise.reject('POST failed!');
      });
    }).catch(err => {
      console.error('addReview failed to fetch!', err);

      // Return an object with a random ID and a property to indicate that is misaligne
      return Promise.resolve({
        ...review,
        createdAt: new Date(),
        id: Math.random().toString(36).substring(2, 7) + Math.random().toString(36).substring(2, 7),
        misaligned: 1
      });
    });
  }

  addReviewToCache(review) {
    this.dbPromise.then(db => {
      return db.transaction('reviews', 'readwrite')
        .objectStore('reviews').put(review);
    })
  }

  removeReviewFromCache(review) {
    this.dbPromise.then(db => {
      return db.transaction('reviews', 'readwrite')
        .objectStore('reviews').delete(review.id);
    })
  }

  addRestaurantToCache(restaurant) {
    this.dbPromise.then(db => {
      return db.transaction('restaurants', 'readwrite')
        .objectStore('restaurants').put(restaurant);
    })
  }

  removeRestaurantFromCache(restaurant) {
    this.dbPromise.then(db => {
      return db.transaction('restaurants', 'readwrite')
        .objectStore('restaurants').delete(restaurant.id);
    })
  }

  static mapParameters(
    restaurants,
    zoom = '12',
    center = '40.722216,-73.987501',
    size = '640x400') {

    let params = [];
    params.push(`zoom=${zoom}`);
    params.push(`center=${center}`);
    params.push(`size=${size}`);
    params.push(`scale=${Math.trunc(window.devicePixelRatio)}`);
    params.push('key=AIzaSyBxgA4ORynngregy413hL73sS8UHiny9IM');

    const mark = [];
    restaurants.forEach(r => {
      mark.push(`markers=label:${r.name.substring(0, 1).toLocaleUpperCase()}|${r.latlng.lat},${r.latlng.lng}`);
    });
    params.push(mark.join('&'));

    return encodeURI(params.join('&'));
  }
}

module.exports = DBHelper;
