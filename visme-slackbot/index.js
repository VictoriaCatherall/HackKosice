// example from
// https://github.com/slackapi/node-slack-sdk
// cut

// https://slack.dev/node-slack-sdk/events-api


const fs = require('fs');
const { createEventAdapter } = require('@slack/events-api');
const { WebClient } = require('@slack/web-api');

const chatbot = require('./chatbot');
const calendar = require('./google-calendar')
const faq = require('./faq');

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackEvents = createEventAdapter(slackSigningSecret);
const port = process.env.PORT || 3000;
const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);

// Attach listeners to events by Slack Event "type". See: https://api.slack.com/events/message.im
slackEvents.on('message', (event) => {
  if (event.channel_type != 'im') {
    return;
  }
  if (typeof event.bot_id != 'undefined' || typeof event.text == 'undefined')
  {
    return;
  }
  if (typeof event.text.length == 0)
  {
    return;
  }
  console.log(`message.im: ${event.text}`);
  faq.ask(event.text, (err, answer) => {
    const channelId = event.channel;
    if (err || answer.answer == 'No good match found in KB.') {
      fs.readFile('./credentials.json', (err, content) => {
        if (err) {
          return console.log('Error loading client secret file:', err);
        }
        calendar.authorize(JSON.parse(content), (auth) => {
          const dates = chatbot.toJSDates(chatbot.getDates(event.text));
          if (dates.length) {
            if (dates.length == 1) {
              let day = chatbot.dayBounds(dates[0]);
              calendar.getEvents(auth, day[0], day[1]);
            } else if (dates.length == 2) {
              calendar.getEvents(auth, dates[0], dates[1]);
            } else {
              web.chat.postMessage({ channel: channelId, text: "<https://www.youtube.com/watch?v=dQw4w9WgXcQ|HHAHAHA>" });
            }
          } else {
            const eventNames = chatbot;
          }
        });
      });
    } else {
      web.chat.postMessage({ channel: channelId, text: answer.score + answer.answer });
    }
  });
});

(async () => {
  const server = await slackEvents.start(port);
  console.log(`Listening for events on ${server.address().port}`);
})();

