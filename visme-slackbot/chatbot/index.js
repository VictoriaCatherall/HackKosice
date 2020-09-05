const nlp = require('compromise');

function getNouns(text) {
  const doc = nlp(text);
  return doc.nouns().json();
}

module.exports = {
  getNouns,
};

