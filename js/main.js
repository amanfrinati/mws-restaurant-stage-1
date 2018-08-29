'use strict';

const DBHelper = require('./dbhelper');

let restaurants;
let neighborhoods;
let cuisines;
const dbHelper = new DBHelper();

/**
 * Register the Service Worker
 */
if (navigator.serviceWorker) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../sw.js')
      .then(
        () => {
          if (!navigator.serviceWorker.controller) {
            return;
          }
        },
        (err) => console.error(`ServiceWorker registration failed: ${err}`)
      )
      .catch(err => console.log(err));
  });
}

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
  fetchNeighborhoods();
  fetchCuisines();

  document.querySelector('select[name="cuisines"]').onchange = updateRestaurants;
  document.querySelector('select[name="neighborhoods"]').onchange = updateRestaurants;

  updateRestaurants();
});

/**
 * Fetch all neighborhoods and set their HTML.
 */
function fetchNeighborhoods() {
  dbHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) { // Got an error
      console.error(error);
    } else {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
}

/**
 * Set neighborhoods HTML.
 */
function fillNeighborhoodsHTML(neighborhoods = self.neighborhoods) {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
}

/**
 * Fetch all cuisines and set their HTML.
 */
function fetchCuisines() {
  dbHelper.fetchCuisines((error, cuisines) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    }
  });
}

/**
 * Set cuisines HTML.
 */
function fillCuisinesHTML(cuisines = self.cuisines) {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
}

/**
 * Initialize Static Google map
 */
function loadStaticMap(restaurants) {
  const map = document.getElementById('map');
  map.innerHTML = '';

  const gMap = document.createElement('img');
  gMap.classList.add('static-map');
  gMap.setAttribute('alt', 'Position of filtered restaurant');
  gMap.setAttribute('src', `https://maps.googleapis.com/maps/api/staticmap?${DBHelper.mapParameters(restaurants)}`);

  map.appendChild(gMap);
}

/**
 * Update page and map for current restaurants.
 */
function updateRestaurants() {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  dbHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML();
      loadStaticMap(restaurants);
    }
  });
}

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
function resetRestaurants(restaurants) {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Hide message alert
  document.getElementById('no-restaurants-alert').classList.add('hidden');

  // Remove all map markers
  if (self.markers) {
    self.markers.forEach(marker => marker.setMap(null));
  }
  self.markers = [];
  self.restaurants = restaurants;
}

/**
 * Create all restaurants HTML and add them to the webpage.
 */
function fillRestaurantsHTML(restaurants = self.restaurants) {
  const ul = document.getElementById('restaurants-list');
  if (restaurants.length) {
    restaurants.forEach(restaurant => {
      ul.append(createRestaurantHTML(restaurant));
    });
  } else {
    // Show message alert
    document.getElementById('no-restaurants-alert').classList.remove('hidden');
  }
}

/**
 * Create restaurant HTML.
 */
function createRestaurantHTML(restaurant) {
  const li = document.createElement('li');

  const image = document.createElement('img');
  image.className = 'restaurant-img';
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.srcset = DBHelper.imageSrcsetForRestaurant(restaurant);
  image.sizes = '(min-width: 650px) 270px, calc(100vw - 20px)';
  image.alt = `${restaurant.name} ${restaurant.cuisine_type} restaurant`;
  li.append(image);

  const title = document.createElement('div');
  title.classList.add('thumbnails-title');

  const star = document.createElement('span');
  if (DBHelper.isFavoriteRestaurant(restaurant)) {
    star.classList.add('fas');
    star.setAttribute('aria-label', `${restaurant.name} is among your favorites`);
  } else {
    star.classList.add('far');
    star.setAttribute('aria-label', `${restaurant.name} is not among your favorites`);
  }
  star.innerHTML = '&#xf005';
  title.appendChild(star);

  const name = document.createElement('h3');
  name.innerHTML = restaurant.name;
  title.appendChild(name);
  li.append(title);

  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement('p');
  address.innerHTML = restaurant.address;
  li.append(address);

  const more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.href = DBHelper.urlForRestaurant(restaurant);
  more.setAttribute('role', 'button');
  li.append(more);

  return li;
}
