// example from
// https://github.com/slackapi/node-slack-sdk
// cut

// https://slack.dev/node-slack-sdk/events-api

const { createEventAdapter } = require('@slack/events-api');
const { WebClient } = require('@slack/web-api');

const chatbot = require('./chatbot');

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
  if (typeof event.bot_id != 'undefined')
  {
    return;
  }
  console.log(`message.im: ${event.text}`);
  const channelId = event.channel;
  web.chat.postMessage({ channel: channelId, text: chatbot.getNouns(event.text).map(n => n.text).join(', ') });
});

(async () => {
  const server = await slackEvents.start(port);
  console.log(`Listening for events on ${server.address().port}`);
})();

