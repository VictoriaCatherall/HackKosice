module.exports = (req, res, next) => {
  console.log('incoming webhook');
  console.log(req.body);
  var clump = JSON.parse(req.body);
  var querrr = clump["intent"]["query"];
  dummy(querrr, function (ans) {
    res.status = 200;
    ////////////
    var msg = {
      prompt: {
        override: true,
        firstSimple: {
          speech: ans,
          text: ans
        }
      }
    }
    res.send(msg);

    next();
  });
};
