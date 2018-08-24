'use strict';

const DBHelper = require('./dbhelper');

let restaurant;
let map;

document.addEventListener('DOMContentLoaded', () => {
  DBHelper.fetchAndCacheReviews();

  document.querySelector('#add-new-review').addEventListener('submit', (e) => {
    e.preventDefault();

    const reviewer_name = document.querySelector('#name');
    const comment_text = document.querySelector('#comment');
    const rating = document.querySelector('#rating');
    addNewReview(reviewer_name.value, comment_text.value, rating.value);
  });
});

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  fetchRestaurantFromURL.then((restaurant) => {
    self.map = new google.maps.Map(document.getElementById('map'), {
      zoom: 16,
      center: restaurant.latlng,
      scrollwheel: false
    });
    fillBreadcrumb();
    DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
  }).catch(error => console.error(error));
};

/**
 * Get current restaurant from page URL.
 */
const fetchRestaurantFromURL = new Promise((resolve, reject) => {
  if (self.restaurant) { // restaurant already fetched!
    resolve(self.restaurant);
  }

  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    reject('No restaurant id in URL');
  } else {
    resolve(
      Promise.all(
        DBHelper.fetchRestaurantById(id)
          .then(restaurant => {
            self.restaurant = restaurant;
            fillRestaurantHTML();
            return restaurant;
          })
          .catch(err => err),

        DBHelper.fetchReviewsByRestaurantId(id)
          .then(reviews => {
            console.log('reviews', reviews);
          }).catch(err => err)
      ).then((restaurants, reviews) => restaurants)
    );




    //   self.restaurant.reviews = reviews;
    //   fillReviewsHTML();
    //   callback(null, self.restaurant);
    // });
    // }
  }
});

/**
 * Create restaurant HTML and add it to the webpage
 */
function fillRestaurantHTML(restaurant = self.restaurant) {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

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
  // fill reviews
  // fillReviewsHTML();
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

  const title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
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
  date.classList.add('comment-date');
  date.innerHTML = review.date;
  div.appendChild(date);

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
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

/**
 * Add new review
 */
function addNewReview(reviewer_name, comment_text, rating) {
  fetch(`${DBHelper.BASE_URL}/reviews/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      'restaurant_id': self.restaurant.id,
      'name': reviewer_name,
      'rating': rating,
      'comments': comment_text
    })
  }).then(res => {
    if (res.ok) {
      // reload reviews
    }
  }).catch(err => console.error(err));
}
