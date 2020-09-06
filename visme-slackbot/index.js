
const express = require('express');
const app = express();
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
app.use('/slack/actions', slackInteractions.requestListener());
app.use(express.json());

const dateSelectBlocks = [
  {
    "type": "section",
    "text": {
      "type": "plain_text",
      "text": "Sorry, I didn't get the day. Please could you select it from this calendar:"
    },
    "accessory": {
      "type": "datepicker",
      "action_id": "datepickeraction",
      "placeholder": {
        "type": "plain_text",
        "text": "Select a date",
      }
    }
  }
];

// Convert result from google-calendar to posted messages
function formatEvents(events) {
  return events.map(r => `${r.summary}, at ${r.start.dateTime || r.start.date}   <${r.htmlLink}|Add to calendar>`).join('\n');
}

fs.readFile('./credentials.json', (err, content) => {
  if (err) {
    return console.error('Error loading client secret file:', err);
  }
  calendar.authorize(JSON.parse(content), (auth) => {

    // listen for datepicker changing
    slackInteractions.action({}, (payload, respond) => {
      try {
        const action = payload.actions[0];
        if (payload.type == "block_actions" && action.action_id == "datepickeraction") {
          const [from, to] = chatbot.dayBounds(action.selected_date);
          calendar.getEvents(auth, from, to, (err, events) => {
            if (err) {
              console.error('Error in the calendar', err);
            } else {
              if (events.length) {
                respond({text: formatEvents(events)});
              } else {
                respond({text: 'No events found for this date range.'});
              }
            }
          });
        } else {
          console.error("Something updated..?");
        }
      } catch (e) {
        console.error(e);
        respond({text: 'Sorry about this, our datepicker seems to be broken... could you try asking again with a different phrasing?'});
      }
    });

    function ask(text, postMessage) {
      if (text == 'hi') return postMessage({text: "Hi there, how may I help?"});
      faq.ask(text, (err, answer) => {
        if (err || !answer) {
          const dates = chatbot.toJSDates(chatbot.getDates(text));
          const eventNames = chatbot.getSubjects(text);
          if (dates.length) {
            let start, end;
            if (dates.length == 1) {
              if (isNaN(dates[0].getTime())) {
                postMessage({text: "Couldn't understand the date...", blocks: dateSelectBlocks});
                return;
              } else {
                [start, end] = chatbot.dayBounds(dates[0]);
              }
            } else if (dates.length == 2) {
              if (isNaN(dates[0].getTime()) || isNaN(dates[1].getTime())) {
                postMessage({text: "Couldn't understand the date...", blocks: dateSelectBlocks});
                return;
              } else {
                [start, end] = dates;
              }
            } else {
              postMessage({text: "Too many dates! I don't know what to do with all of them, sorry. Please try another phrasing."});
              console.error('too many dates', dates);
              return;
            }
            console.log(start, end);
            calendar.getEvents(auth, start, end, (err, events) => {
              if (err) {
                console.error('BIG ERROR probaly with google calendar api', err);
              } else {
                if (events.length) {
                  postMessage({text: formatEvents(events)});
                } else {
                  postMessage({text: 'No events found for this date range.'});
                }
              }
            });
          } else if (eventNames.length) {
            console.log(eventNames);
            let found = false;
            for (const eventName of eventNames) {
              calendar.getEventsByName(auth, eventName, (err, events) => {
                if (err) {
                  console.error('Error with google calendar api', err);
                  return;
                }
                if (events.length) {
                  postMessage({text: formatEvents(events)});
                  found = true;
                }
              });
            }
            if (!found) {
              postMessage({text: 'No events found for that name'});
            }
          } else {
            postMessage({text: "I don't quite understand what you mean... could you try asking with a different phrasing?"});
          }
        } else {
          postMessage({mrkdwn: true, text: answer.answer});
        }
      });
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
      if (Math.abs(Number(event.ts) - Date.now()/1000) > 4)
      {
        console.log('too far away', Math.abs(Number(event.ts) - Date.now()/1000));
        return;
      }
      console.log(`message.im: ${event.text} ${event.channel}`);
      const channelId = event.channel;
      ask(event.text, answer => web.chat.postMessage({ ...answer, channel: channelId }));
    });

    app.use('/webhook', require('./webhook')(ask));
    app.listen(port);
    web.chat.postMessage({ text: 'Welcome to VisMe Virtual Assistant!', channel: 'D01AJ2CCFNV' })
    console.log(`Listening for events on ${port}`);
  });
});
