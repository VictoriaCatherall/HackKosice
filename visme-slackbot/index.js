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

// Convert result from google-calendar to posted messages
function process_result(channelId, result) {
  if (result.valid) {
    // ensure order with an async
    (async () => {
      await web.chat.postMessage({ channel: channelId, text: "Here are the results: " });
      result.data.map((r) => web.chat.postMessage({ channel: channelId, text: `${r.title}, at ${r.start}   <${r.url}|[Calendar Link]>` }));
      //                               change this for better results in slack ^  you have 'start', 'title', 'url'
    })();
  } else {
    web.chat.postMessage({ channel: channelId, text: result.data });
  }
}

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
          web.chat.postMessage({ channel: channelId, text: "Error loading client secret file."});
          return console.log('Error loading client secret file:', err);
        }
        calendar.authorize(JSON.parse(content), (auth) => {
          const dates = chatbot.toJSDates(chatbot.getDates(event.text));
          if (dates.length) {
            if (dates.length == 1) {
              let day = chatbot.dayBounds(dates[0]);
              calendar.getEvents(auth, day[0], day[1], r => process_result(channelId, r));
            } else if (dates.length == 2) {
              calendar.getEvents(auth, dates[0], dates[1], r => process_result(channelId, r));
            } else {
              web.chat.postMessage({ channel: channelId, text: "Too many dates! I don't know what to do." });
            }
          } else {
            const eventNames = chatbot;
            // Comment out below if you want to do more processing :)
            web.chat.postMessage({ channel: channelId, text: "Too many dates! I don't know what to do." });
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

