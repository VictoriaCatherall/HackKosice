module.exports = (ask) => {
  return (req, res, next) => {
    console.log('incoming webhook');
    var clump = req.body;
    var question = clump["intent"]["query"];
    console.log(`Got webhook question ${question}`);
    ask(question, function (answer) {
      console.log(`Answering webhook with ${answer}`);
      res.status(200);
      var msg = {
        'prompt': {
          'override': true,
          'firstSimple': {
            'speech': answer,
            'text': answer
          }
        }
      };
      res.json(msg);
      next();
    });
  };
};
