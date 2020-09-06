// example from
// https://github.com/slackapi/node-slack-sdk
// cut

// https://slack.dev/node-slack-sdk/events-api


const app = require('express')();
const fs = require('fs');
const { createEventAdapter } = require('@slack/events-api');
const { WebClient } = require('@slack/web-api');
const { createMessageAdapter } = require('@slack/interactive-messages');

const chatbot = require('./chatbot');
const calendar = require('./google-calendar')
const faq = require('./faq');

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackEvents = createEventAdapter(slackSigningSecret);
const slackInteractions = createMessageAdapter(slackSigningSecret);
const port = process.env.PORT || 3000;
const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);
app.use('/slack/events', slackEvents.expressMiddleware());
app.use('/webhook', require('./webhook'));
app.use('/slack/actions', slackInteractions.requestListener());

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

let new_date = null;
function check_validity(date, channelId, text, callback) {
  if (isNaN(date.getTime())) {
    new_date = callback;
    // date is not valid
    web.chat.postMessage({
      channel: channelId,
      blocks: [{
        "type": "section",
        "text": {
          "type": "plain_text",
          "text": text + "date not recognised. please select it from this calendar:"
        },
        "accessory": {
          "type": "datepicker",
          "action_id": "datepickeraction",
          "placeholder": {
            "type": "plain_text",
            "text": "Select a date",
          }
        }
      }]
    });
  } else {
    return callback(date)
  }
}

// listen for datepicker changing
slackInteractions.action({}, (payload, respond) => {
  const a = payload.actions[0]
  respond({text: "Processing with date " + a.selected_date});
  if (payload.type == "block_actions" && a.action_id == "datepickeraction") {
    new_date(a.selected_date);
    new_date = null;
  } else {
    web.chat.postMessage({channel: payload.channel.id, text: "Something updated..?"});
  }
})


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
              check_validity(dates[0], channelId, "", (d) => {
                let day = chatbot.dayBounds(d);
                calendar.getEvents(auth, day[0], day[1], r => process_result(channelId, r));
              });

            } else if (dates.length == 2) {
              check_validity(dates[0], channelId, "first ", (d0) =>
                check_validity(dates[1], channelId, "second ", (d1) =>
                  calendar.getEvents(auth, d0, d1, r => process_result(channelId, r)))
              );
            } else {
              web.chat.postMessage({ channel: channelId, text: "Too many dates! I don't know what to do." });
            }
          } else {
            const eventNames = chatbot.getSubjects(event.text);
            // ^^ returns [ 'Visma traditional breakfast', 'Yoga session' ]
            calendar.getEventsByName(auth, eventNames[0], result => process_result(channelId, result));
          }
        });
      });
    } else {
      web.chat.postMessage({ channel: channelId, text: answer.score + answer.answer });
    }
  });
});

app.listen(port);
console.log(`Listening for events on ${port}`);

