'use strict';

const DBHelper = require('./dbhelper');

let restaurant;
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

document.addEventListener('DOMContentLoaded', () => {

  // Load reviews content to the cache
  fetchRestaurantFromURL.then(() => {
    fillRestaurantHTML();
    fillReviewsHTML();
    fillBreadcrumb();
    loadStaticMap(self.restaurant);
  });

  document.querySelector('#add-new-review').addEventListener('submit', (e) => {
    e.preventDefault();

    const reviewer_name = document.querySelector('#name').value.trim();
    const comment_text = document.querySelector('#comment').value.trim();
    const rating = document.querySelector('#rating').value;

    // Check if reviewer_name and comment_text contains permitted values
    if (reviewer_name === '' || comment_text === '') {
      const div = document.createElement('div');
      div.setAttribute('role', 'alert');
      div.setAttribute('id', 'review-empty-field-alert');
      div.innerHTML = '<strong>Your name</strong> and <strong>Your comment</strong> can\'t be empty!';
      div.classList.add('alert', 'alert-danger');

      const form = document.getElementById('add-new-review');
      form.appendChild(div);

      if (reviewer_name === '') {
        document.getElementById('name').setAttribute('aria-invalid', 'true');
      } else {
        document.getElementById('name').setAttribute('aria-invalid', 'false');
      }

      if (comment_text === '') {
        document.getElementById('comment').setAttribute('aria-invalid', 'true');
      } else {
        document.getElementById('comment').setAttribute('aria-invalid', 'false');
      }
    } else {
      const alert = document.getElementById('review-empty-field-alert');
      if (alert) {
        document.getElementById('add-new-review').removeChild(alert);
      }

      // Submit the date
      addNewReview(reviewer_name, comment_text, rating);
    }
  });

  document.querySelector('#restaurant-favorite').addEventListener('click', (e) => {
    e.preventDefault();

    dbHelper.updateFavorite({
      ...self.restaurant,
      is_favorite: !DBHelper.isFavoriteRestaurant(self.restaurant)
    }).then(result => {
      dbHelper.addRestaurantToCache(result);

      self.restaurant = result;
      fillRestaurantFavoriteHTML(result);
    });
  });
});

/**
 * Initialize Google map, called from HTML.
 */
function loadStaticMap(restaurant) {
  const map = document.getElementById('map');
  map.innerHTML = '';

  const gMap = document.createElement('img');
  gMap.classList.add('static-map');
  gMap.setAttribute('alt', `Position of Restaurant ${restaurant.name}`);
  gMap.setAttribute('sizes', '(min-width: 650px) 50vw, 100vw');
  gMap.setAttribute('src', 'https://maps.googleapis.com/maps/api/staticmap?' +
    DBHelper.mapParameters([restaurant], '17', `${restaurant.latlng.lat},${restaurant.latlng.lng}`, '640x400')
  );

  map.appendChild(gMap);
}

/**
 * Get current restaurant from page URL.
 */
const fetchRestaurantFromURL = new Promise((resolve, reject) => {
  // if (self.restaurant) { // restaurant already fetched!
  //   resolve(self.restaurant);
  // }

  const id = getParameterByName('id');
  if (!id) {
    // no id found in URL
    reject('No restaurant ID in URL');

  } else {
    resolve(
      dbHelper.fetchRestaurantById(id)
        .then(restaurant => {
          self.restaurant = restaurant;
          return dbHelper.fetchReviewsByRestaurantId(restaurant.id)
            .then(reviews => {
              self.restaurant.reviews = reviews;
              return self.restaurant;
            });
        }).catch(err => err)
    );
  }
});

/**
 * Create restaurant HTML and add it to the webpage
 */
function fillRestaurantHTML(restaurant = self.restaurant) {
  const name = document.getElementById('restaurant-name');
  name.insertAdjacentHTML('afterbegin', restaurant.name);

  const star = document.getElementById('restaurant-favorite');
  star.classList.add('pointer', 'far');
  star.innerHTML = '&#xf005';
  fillRestaurantFavoriteHTML(restaurant);

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img';
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.srcset = DBHelper.imageSrcsetForRestaurant(restaurant);
  image.sizes = '(min-width: 650px) calc(50vw - 60px), calc(100vw - 20px)';
  image.alt = `${restaurant.name} ${restaurant.cuisine_type} restaurant`;

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }

  fillRestaurantMisalignedAlter();
}

function fillRestaurantFavoriteHTML(restaurant = self.restaurant) {
  const star = document.getElementById('restaurant-favorite');

  if (DBHelper.isFavoriteRestaurant(restaurant)) {
    star.classList.replace('far', 'fas');
    star.setAttribute('aria-label', `${restaurant.name} is among your favorites`);
  } else {
    star.classList.replace('fas', 'far');
    star.setAttribute('aria-label', `${restaurant.name} is not among your favorites`);
  }

  const divNotSync = document.getElementById('restaurant-not-sync');
  if (restaurant.misaligned) {
    divNotSync.classList.remove('hidden');
  } else {
    divNotSync.classList.add('hidden');
  }
}

function fillRestaurantMisalignedAlter() {
  const warningMsg = 'Warning! This restaurant is not sync with the server because you are offline. Data will be sync next connection.';

  const divNotSync = document.getElementById('restaurant-not-sync');
  divNotSync.classList.add('hidden');

  const offlineWarning = document.createElement('div');
  offlineWarning.classList.add('tooltip');

  const warningIcon = document.createElement('span');
  warningIcon.classList.add('fas', 'r-exclamation-triangle');
  warningIcon.setAttribute('aria-label', warningMsg);
  warningIcon.innerHTML = '&#xf071';
  offlineWarning.appendChild(warningIcon);

  const tooltip = document.createElement('span');
  tooltip.classList.add('tooltiptext', 'tooltiptext-left');
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.innerHTML = warningMsg;
  offlineWarning.appendChild(tooltip);

  divNotSync.appendChild(offlineWarning);
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
function fillRestaurantHoursHTML(operatingHours = self.restaurant.operating_hours) {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
function fillReviewsHTML(reviews = self.restaurant.reviews) {
  const container = document.getElementById('reviews-details');

  const noReviews = document.createElement('p');
  noReviews.id = 'no-reviews-message';
  noReviews.innerHTML = 'No reviews yet!';
  noReviews.classList.add('hidden');
  container.appendChild(noReviews);

  populateReviews(reviews);
}

function populateReviews(reviews = []) {
  const noReviews = document.getElementById('no-reviews-message');
  reviews.length ? noReviews.classList.add('hidden') : noReviews.classList.remove('hidden');

  const ul = document.getElementById('reviews-list');
  while (ul.firstChild) {
    ul.removeChild(ul.firstChild);
  }

  // Sort reviews array by date ascending
  reviews.sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  }).forEach(review =>
    ul.appendChild(createReviewHTML(review))
  );
}

/**
 * Create review HTML and add it to the webpage.
 */
function createReviewHTML(review) {
  const li = document.createElement('li');

  let div = document.createElement('div');
  div.classList.add('comment-header');

  const name = document.createElement('span');
  name.classList.add('comment-name');
  name.innerHTML = review.name;
  div.appendChild(name);

  const date = document.createElement('span');
  const createdAtDate = new Date(review.createdAt);
  date.classList.add('comment-date');
  const hours = createdAtDate.getHours();
  const minutes = createdAtDate.getMinutes();
  const month = createdAtDate.getMonth();
  const day = createdAtDate.getDate();

  date.innerHTML =
    `${createdAtDate.getFullYear()}/${month < 10 ? '0' + month : month}/${day < 10 ? '0' + day : day} at ${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}`;
  div.appendChild(date);

  if (review.misaligned) {
    /* Tooltip idea from https://www.w3schools.com/css/css_tooltip.asp */
    const warningMsg = 'Warning! This review is not sync with the server because you are offline. Data will be sync next connection.';

    const offlineWarning = document.createElement('div');
    offlineWarning.classList.add('tooltip');

    const warningIcon = document.createElement('span');
    warningIcon.classList.add('fas', 'exclamation-triangle');
    warningIcon.setAttribute('aria-label', warningMsg);
    warningIcon.innerHTML = '&#xf071';
    offlineWarning.appendChild(warningIcon);

    const tooltip = document.createElement('span');
    tooltip.classList.add('tooltiptext', 'tooltiptext-right');
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.innerHTML = warningMsg;
    offlineWarning.appendChild(tooltip);

    div.appendChild(offlineWarning);
  }

  li.appendChild(div);

  div = document.createElement('div');
  div.classList.add('comment-rating');
  const rating = document.createElement('span');
  rating.innerHTML = `Rating: ${review.rating}`;

  // Add rating property to change the background color
  rating.classList.add(`rating-${review.rating}`);

  div.appendChild(rating);
  li.appendChild(div);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  comments.classList.add('comment-body');
  li.appendChild(comments);

  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
function fillBreadcrumb(restaurant = self.restaurant) {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');

  const a = document.createElement('a');
  a.href = DBHelper.urlForRestaurant(restaurant);
  a.innerHTML = restaurant.name;
  a.setAttribute('aria-current', 'page');

  li.appendChild(a);
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
function getParameterByName(name, url) {
  if (!url) {
    url = window.location.href;
  }
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`);

  const results = regex.exec(url);
  if (!results) {
    return null;
  }

  if (!results[2]) {
    return '';
  }

  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

/**
 * Add new review
 */
function addNewReview(reviewer_name, comment_text, rating) {
  const reviewObj = {
    restaurant_id: self.restaurant.id,
    name: reviewer_name,
    rating: rating,
    comments: comment_text
  };

  DBHelper.addReview(reviewObj).then(response => {
    dbHelper.addReviewToCache(response);

    // Put the new review to the reviews array and show it
    self.restaurant.reviews.push(response);
    populateReviews(self.restaurant.reviews);

    clearAddReviewForm();

  }).catch(err =>
    console.error('addNewReview error!', err)
  );
}

function clearAddReviewForm() {
  document.querySelector('#name').value = '';
  document.querySelector('#comment').value = '';
  document.querySelector('#rating').value = 1;
}