# bundle.social for Zapier

This is the [Zapier](https://zapier.com) integration for [bundle.social](https://bundle.social). It covers the whole publishing workflow from your Zaps: set up teams, connect social accounts, upload media, schedule posts to 15 social networks and track how they perform, with unlimited social accounts. It also answers Instagram and Facebook direct messages and manages comment and DM automations.

[Zapier](https://zapier.com) connects thousands of apps, so a post can start from a form, a spreadsheet row, a CMS entry or anything else your Zaps already react to.

- [Credentials](#credentials)
- [Usage](#usage)
- [Triggers](#triggers)
- [Actions](#actions)
- [Development](#development)
- [Compatibility](#compatibility)
- [Resources](#resources)

## Credentials

The integration authenticates with a bundle.social API key.

1. Sign in to [bundle.social](https://bundle.social/dashboard) and open **Organization > API Keys**.
2. Create an API key and copy it.
3. In Zapier, connect a **bundle.social** account and paste the key into **API Key**.

The key is only ever sent to `https://api.bundle.social`, never to the hosts files are downloaded from.

## Usage

- **Team**, **Social Account**, **Post** and **Upload** fields are dropdowns loaded from your organization; you can also map an ID from an earlier step. **Post** dropdowns list the posts of the selected team, so pick the team first.
- **Connect Social Account** returns a URL. Open it to sign in to the social network and the account is connected to the team.
- **Create Post** has one settings section per platform (*TikTok Settings*, *Instagram Settings*, ...). Only the sections of the platforms picked in **Social Account Types** are shown. When that field is mapped from an earlier step, every section is shown.
- Media goes in two steps: upload it with **Upload File** (a file from an earlier step, or a URL) or **Upload From URL**, then map the returned `id` into **Upload IDs** of the post. **Upload From URL** is the best fit for public links and long videos, because bundle.social downloads the file itself.
- **Upload File** takes files up to 90 MB. **Upload Large File** takes files up to 5 GB: it sends the file straight to storage and adds it to the media library in one step. The *Initialize*, *Finalize* and *Multipart* upload actions expose the individual steps for files above 5 GB or custom flows.
- **Update Post** shows the settings of every platform: changing **Social Account Types** there changes the platforms of the post, so it does not hide sections. Fields left empty keep their current value.
- To tag a TikTok location, run **Search Locations (TikTok)** first and map the `locationId` and `name` it returns into the post's **TikTok: Location ID** and **TikTok: Location Name**.
- **Get Post Analytics** takes the **Post ID** together with the **Platform Type** the post went out on.
- Direct messages and automations are switched on per organization by [bundle.social support](mailto:support@bundle.social); until then their actions fail. Each Instagram or Facebook account also needs **Enable Messaging (Social Account)** before it receives DMs.
- **Send Message (Conversation)** only works within 24 hours of the participant's last message, which is Meta's rule. To answer a comment with a DM, use **Send Private Reply (Conversation)**: one text-only reply per comment.
- **Create Automation** takes the trigger as fields and the steps as JSON. The flow builder in the bundle.social dashboard shows the definition JSON of any flow you build there. A flow stays a draft until **Publish Automation**, and a definition sent with **Update Automation** replaces the whole draft.
- Every action with a request body has **Specify Body**. Switch it to **Using JSON** to send the raw request body, which is handy for automation flow definitions or when the body comes from an earlier step.
- Validation errors from the API list each invalid field, for example `data.TIKTOK.text: Required`.
- Fields that take several values (for example **Upload IDs**) accept one value per line, a comma-separated list or a JSON array.

### Example: schedule a post with an image

1. **Trigger**: any app that produces an image URL or file.
2. **bundle.social > Upload File**: map the file into **File**.
3. **bundle.social > Create Post**:
   - Team: your team
   - Social Account Types: `Instagram`, `LinkedIn`
   - Post Date: when to publish (a Formatter step can add an offset to the current time)
   - Status: `Scheduled`
   - Instagram: Text, Instagram: Upload IDs: the `id` from step 2
   - LinkedIn: Text, LinkedIn: Upload IDs: the `id` from step 2

### Example: report on published posts

1. **bundle.social > Post Published**: your team.
2. **bundle.social > Get Post Analytics**: map the post `id`, and the platform it went out on into **Platform Type**.
3. **Google Sheets > Create Spreadsheet Row** (or any app): log the likes, comments, shares and views.

### Example: answer new direct messages

1. **bundle.social > New Direct Message**: your team.
2. Any app that writes the answer, for example an AI step that reads **Last Message Preview**.
3. **bundle.social > Send Message (Conversation)**: map **Conversation ID** from step 1, and the answer into **Content: Text**.

## Triggers

Triggers check bundle.social on Zapier's polling interval.

| Trigger | Fires when | Endpoint |
|---|---|---|
| New Post | a post is created in a team | `GET /api/v1/post/?orderBy=createdAt` |
| Post Published | a post finishes publishing | `GET /api/v1/post/?status=POSTED` |
| Post Failed | a post fails to publish | `GET /api/v1/post/?status=ERROR` |
| New Team | a team is created in your organization | `GET /api/v1/team/` |
| New Social Account | a social account is connected to a team | `GET /api/v1/team/` |
| New Comment | bundle.social imports a new comment on the selected post | `GET /api/v1/comment/import/comments` |
| New Direct Message | someone sends a direct message to a connected Instagram or Facebook account | `GET /api/v1/conversations/` |

The post triggers can be narrowed to posts on specific platforms (New Post also to a status), New Social Account to one team, New Direct Message to one account or platform.

**New Direct Message** fires once for every message the participant sends, never for your own replies, so a Zap that answers with Send Message does not trigger itself. It returns the conversation: map its **Conversation ID** into the conversation actions, and add **Get Messages (Conversation)** for the full thread.

## Actions

<!-- actions:start -->

100 actions, generated from the bundle.social OpenAPI spec.

| Action | What it does | Endpoint |
|---|---|---|
| Get Bulk Post Analytics | Retrieves the analytics of up to 60 published posts on one network in a single step. | `GET /api/v1/analytics/post/bulk` |
| Get Post Analytics | Retrieves engagement metrics such as likes, comments, shares and views for a published post. | `GET /api/v1/analytics/post` |
| Get Raw Post Analytics | Retrieves the analytics of a published post exactly as the network returns them, for metrics the standard analytics leave out. | `GET /api/v1/analytics/post/raw` |
| Get Raw Social Account Analytics | Retrieves the analytics of a connected social account exactly as the network returns them, for metrics the standard analytics leave out. | `GET /api/v1/analytics/social-account/raw` |
| Get Social Account Analytics | Retrieves profile metrics such as followers, reach and impressions for a connected social account. | `GET /api/v1/analytics/social-account` |
| Refresh Post Analytics | Fetches fresh analytics for a published post from the network right away. Uses network rate limits, so use it sparingly. | `POST /api/v1/analytics/post/force` |
| Refresh Social Account Analytics | Fetches fresh analytics for a connected social account from the network right away. Uses network rate limits, so use it sparingly. | `POST /api/v1/analytics/social-account/force` |
| Activate Automation | Makes a paused or archived automation flow live again with its published version. | `POST /api/v1/automations/{id}/activate` |
| Archive Automation | Retires an automation flow without deleting it. Archived flows never run. | `POST /api/v1/automations/{id}/archive` |
| Copy Automation | Copies one or every automation flow of a team to another team as drafts, ready to point at that team's social accounts. | `POST /api/v1/automations/copy` |
| Create Automation | Creates an automation flow, such as an auto-reply to comments or direct messages, from a trigger and its steps. The flow stays a draft until you publish it. | `POST /api/v1/automations` |
| Delete Automation | Permanently deletes an automation flow and cancels its waiting runs. Past runs stay readable. | `DELETE /api/v1/automations/{id}` |
| Find Automation | Finds an automation flow by ID, with its status and its draft and published definitions. | `GET /api/v1/automations/{id}` |
| Get Execution (Automation) | Retrieves an automation run by ID, with its input event, the result of each step and any error. | `GET /api/v1/automation-executions/{id}` |
| Get Executions (Automation) | Lists the runs of an automation flow, newest first, with how each one ended. | `GET /api/v1/automations/{id}/executions` |
| Get Many Automation Flows | Lists the automation flows of a team, newest first. | `GET /api/v1/automations` |
| Pause Automation | Stops a live automation flow from running on new events, keeping its configuration. | `POST /api/v1/automations/{id}/pause` |
| Publish Automation | Validates the saved draft of an automation flow and makes it live, so matching comments and messages start triggering it. | `POST /api/v1/automations/{id}/publish` |
| Send Rich Message (Automation) | Sends a message with uploaded media, buttons, quick replies or a carousel in a conversation, in the format of an automation step. | `POST /api/v1/automation-rich-messages/conversations/{conversationId}` |
| Test Automation | Runs an automation flow once on a real conversation or comment and returns the run. Its steps really send messages. | `POST /api/v1/automations/{id}/test` |
| Update Automation | Updates the name or definition of an automation flow. A new definition is saved as a draft and goes live when you publish it. | `PATCH /api/v1/automations/{id}` |
| Create or Update Automation Provider Setting | Saves the Instagram ice breakers or the Facebook persistent menu of a social account. Sync Automation Provider Setting pushes it to the network. | `PUT /api/v1/automation-provider-settings/{socialAccountId}/{type}` |
| Get Many Automation Provider Settings | Lists the Instagram ice breakers and Facebook persistent menus saved for the social accounts of a team. | `GET /api/v1/automation-provider-settings` |
| Sync Automation Provider Setting | Pushes saved ice breakers or a saved persistent menu to Instagram or Facebook, for example after a failed sync. | `POST /api/v1/automation-provider-settings/{id}/sync` |
| Create Comment | Schedules a comment, or publishes it right away, on a published post or as a reply to a comment, for example the first comment of an Instagram or LinkedIn post. | `POST /api/v1/comment/` |
| Delete Comment | Permanently deletes a comment from bundle.social. Deleting a scheduled comment cancels it. | `DELETE /api/v1/comment/{id}` |
| Find Comment | Finds a comment created through bundle.social by ID, with its publishing status and errors. | `GET /api/v1/comment/{id}` |
| Get Many Comments | Returns many comments. Paging is handled for you. | `GET /api/v1/comment/` |
| Retry Comment | Publishes a failed comment again, for example after reconnecting an expired account. | `POST /api/v1/comment/{id}/retry` |
| Update Comment | Updates the text or scheduled time of a comment that has not been published yet. Fields left empty keep their current value. | `PATCH /api/v1/comment/{id}` |
| Act on Fetched Comment (Comment Import) | Hides, unhides, likes, unlikes, approves, rejects or deletes an imported comment directly on the network. | `POST /api/v1/comment/import/comments/{commentId}/action` |
| Create Comment Import | Starts importing the existing comments of a published post from the network. | `POST /api/v1/comment/import` |
| Find Comment Import | Finds a comment import by ID, with its status, progress and result. | `GET /api/v1/comment/import/{importId}` |
| Get Fetched Comments (Comment Import) | Lists the comments imported from the network for a post. | `GET /api/v1/comment/import/comments` |
| Get Many Comment Imports | Lists the comment imports of a team with their status. | `GET /api/v1/comment/import` |
| Archive Conversation | Moves a conversation out of the active inbox. A new incoming message reopens it. | `POST /api/v1/conversations/{id}/archive` |
| Find Conversation | Finds a direct message conversation by ID, with its participant, unread count and whether you can still reply. | `GET /api/v1/conversations/{id}` |
| Get Many Conversations | Lists the Instagram and Facebook direct message conversations of a team, most recently active first. | `GET /api/v1/conversations/` |
| Get Messages (Conversation) | Lists the messages of a direct message conversation with their attachments, reactions and delivery status. | `GET /api/v1/conversations/{id}/messages` |
| Mark as Read (Conversation) | Marks a conversation as read, which resets its unread count. | `POST /api/v1/conversations/{id}/read` |
| Open Conversation | Moves an archived conversation back into the active inbox. | `POST /api/v1/conversations/{id}/open` |
| React to Message (Conversation) | Adds or removes a reaction on a message in a conversation. Only Instagram supports reactions, with the heart. | `POST /api/v1/conversations/{id}/messages/{messageId}/reaction` |
| Send Message (Conversation) | Sends a direct message with text, media, buttons, quick replies or a carousel in a conversation. Meta allows it within 24 hours of the participant's last message. | `POST /api/v1/conversations/{id}/messages` |
| Send Private Reply (Conversation) | Answers an imported Facebook or Instagram comment with a direct message to its author. Meta allows one text-only reply per comment. | `POST /api/v1/conversations/private-reply` |
| Update Conversation | Sets the inbox status of a conversation to open or archived. | `PATCH /api/v1/conversations/{id}` |
| Get Comments Usage (Organization) | Retrieves how many comments your organization has used against its plan limit this billing period. | `GET /api/v1/organization/usage/comments` |
| Get Daily Limits Usage (Organization) | Retrieves how many posts a social account has published on a given day against the network's daily cap. | `GET /api/v1/organization/usage/daily-limits` |
| Get DM Usage (Organization) | Retrieves how many direct messages and automation runs each Instagram, Facebook and TikTok account has used this calendar month (UTC) against its monthly limits. | `GET /api/v1/organization/usage/messages` |
| Get Imports Usage (Organization) | Retrieves the post history import usage of each social account, by team or platform. | `GET /api/v1/organization/usage/imports` |
| Get Organization | Retrieves your bundle.social organization with its plan details. | `GET /api/v1/organization/` |
| Get Posts Usage (Organization) | Retrieves how many posts your organization has used against its plan limit this billing period. | `GET /api/v1/organization/usage/posts` |
| Get Uploads Usage (Organization) | Retrieves how much upload capacity your organization has used against its plan limit this billing period. | `GET /api/v1/organization/usage/uploads` |
| Create Post | Schedules a post, or publishes it right away, to one or more connected social accounts. | `POST /api/v1/post/` |
| Delete Post | Permanently deletes a post from bundle.social. | `DELETE /api/v1/post/{id}` |
| Find Post | Finds a post by ID, with its per-platform status, scheduled time, media and publishing errors. | `GET /api/v1/post/{id}` |
| Find Post by Reference Key | Finds a post by the reference key you gave it when creating it. | `GET /api/v1/post/reference-key/{referenceKey}` |
| Get Many Posts | Returns many posts. Paging is handled for you. | `GET /api/v1/post/` |
| Get Reconnect Candidates (Post) | Lists the posts that lost their social account when it was disconnected and can be moved to a newly connected account of the same network. | `GET /api/v1/post/reconnect-social-account/candidates` |
| Reconnect Social Account (Post) | Moves posts that lost their social account to the team's newly connected account of the same network, so scheduled posts publish instead of failing. | `POST /api/v1/post/reconnect-social-account` |
| Retry Post | Publishes a failed post again, for example after reconnecting an expired account. | `POST /api/v1/post/{id}/retry` |
| Update Post | Updates the content, media, scheduled time or platforms of a post that has not been published yet. Fields left empty keep their current value. | `PATCH /api/v1/post/{id}` |
| Create Post History Import | Starts importing the posts a social account published before it was connected, together with their analytics. | `POST /api/v1/post-history-import/` |
| Delete Imported Posts (Post History Import) | Permanently deletes up to 100 imported posts and their analytics, freeing import capacity. | `DELETE /api/v1/post-history-import/posts` |
| Find Post History Import | Finds a post history import by ID, with its status, progress and result. | `GET /api/v1/post-history-import/{importId}` |
| Get Imported Posts (Post History Import) | Lists the posts imported for a social account with their analytics, and the import capacity left. | `GET /api/v1/post-history-import/posts` |
| Get Many Post History Imports | Lists the post history imports of a team with their status. | `GET /api/v1/post-history-import/` |
| Retry Post History Import | Runs a failed post history import again. | `POST /api/v1/post-history-import/{importId}/retry` |
| Connect Social Account | Generates the link that connects a social account to a team. Open the returned URL to sign in to the network and finish connecting. | `POST /api/v1/social-account/connect` |
| Copy Social Account | Copies connected social accounts from one team to another, reusing their authorization without signing in again. | `POST /api/v1/social-account/copy` |
| Create Portal Link (Social Account) | Generates a hosted portal link where your users connect and manage the social accounts of a team themselves. | `POST /api/v1/social-account/create-portal-link` |
| Disable Messaging (Social Account) | Turns off direct message processing for the Facebook page or Instagram account of a team. | `POST /api/v1/social-account/messaging/disable` |
| Disconnect Social Account | Disconnects a social account from a team and removes it from all scheduled posts. | `DELETE /api/v1/social-account/disconnect` |
| Enable Messaging (Social Account) | Turns on direct message processing for the Facebook page or Instagram account of a team. Requires DM access for your organization. | `POST /api/v1/social-account/messaging/enable` |
| Get Scheduled for Deletion (Social Account) | Lists the social accounts queued for permanent deletion. | `GET /api/v1/social-account/to-delete` |
| Get Social Account by Type | Retrieves the team's connected social account on the selected network. | `GET /api/v1/social-account/by-type` |
| Refresh Channels (Social Account) | Reloads the channels available to a Reddit, Discord, Slack or Pinterest account from the network. | `POST /api/v1/social-account/refresh-channels` |
| Refresh Profile (Social Account) | Updates the profile name, handle and avatar of a social account from the network. | `POST /api/v1/social-account/profile-refresh` |
| Run Connection Check (Social Account) | Checks right away whether a social account is still authorized, so an expired connection shows up before a post fails. | `POST /api/v1/social-account/connection-check` |
| Set Channel (Social Account) | Selects the page, channel or organization a YouTube, Instagram, Facebook or LinkedIn account posts to. | `POST /api/v1/social-account/set-channel` |
| Unset Channel (Social Account) | Clears the selected page, channel or organization of a social account, keeping its authorization. | `POST /api/v1/social-account/unset-channel` |
| Create Team | Creates a new team in your bundle.social organization. | `POST /api/v1/team/` |
| Delete Team | Permanently deletes a team along with its connected social accounts, posts and uploads. | `DELETE /api/v1/team/{id}` |
| Find Team | Finds a team by ID, with its connected social accounts and settings. | `GET /api/v1/team/{id}` |
| Get Many Teams | Returns many teams. Paging is handled for you. | `GET /api/v1/team/` |
| Update Team | Updates a team's name or avatar. Fields left empty keep their current value. | `PATCH /api/v1/team/{id}` |
| Get Post Settings (TikTok) | Retrieves the privacy levels, comment, Duet and Stitch settings and maximum video length the TikTok account of a team allows. | `GET /api/v1/misc/tiktok/post-settings` |
| Search Locations (TikTok) | Searches the location tags the TikTok account of a team can add to a post, for Location ID and Location Name in Create Post. | `GET /api/v1/misc/tiktok/locations` |
| Abort Multipart Upload | Discards an unfinished multipart upload and the parts already sent. | `POST /api/v1/upload/multipart/abort` |
| Complete Multipart Upload | Assembles the uploaded parts of a multipart upload and adds the file to the media library. | `POST /api/v1/upload/multipart/complete` |
| Delete Many Uploads | Permanently deletes several media files from the media library at once. | `DELETE /api/v1/upload/` |
| Delete Upload | Permanently deletes a media file from the media library. | `DELETE /api/v1/upload/{id}` |
| Finalize Large Upload | Adds a file sent to the signed URL of Initialize Large Upload to the media library. | `POST /api/v1/upload/finalize` |
| Find Upload | Finds a media file by ID, with its processing status, dimensions, duration and the posts using it. | `GET /api/v1/upload/{id}` |
| Get Many Uploads | Returns many uploads. Paging is handled for you. | `GET /api/v1/upload/` |
| Initialize Large Upload | Starts an upload of a file over 90 MB and returns the signed URL to send the file to. Upload Large File does every step for you. | `POST /api/v1/upload/init` |
| Initialize Multipart Upload | Starts an upload of a file over 5 GB in parts and returns one signed URL per part. Upload Large File covers files up to 5 GB. | `POST /api/v1/upload/multipart/init` |
| Sign Multipart Upload Parts | Issues new signed URLs for parts of a multipart upload whose URLs expired. | `POST /api/v1/upload/multipart/sign` |
| Upload File | Uploads an image, video or document of up to 90 MB to the media library, for use in posts. | `POST /api/v1/upload/` |
| Upload From URL | Adds an image or video to the media library from a public URL, for use in posts. | `POST /api/v1/upload/from-url` |
| Upload Large File | Uploads a file of up to 5 GB, such as a long video, to the media library: sends the file straight to storage and adds it for use in posts. | `POST /api/v1/upload/init, then storage PUT, then /api/v1/upload/finalize` |

<!-- actions:end -->

## Development

The actions in `generated/` are generated from the bundle.social OpenAPI spec. Do not edit them by hand.

```bash
# Refresh the spec and regenerate
npm run fetch-openapi
npm run generate

npm install
npm test                       # schema validation plus request tests against a mocked API
npx zapier-platform validate   # the checks Zapier runs on push
bash scripts/smoke-test.sh     # every trigger and action against the real API (reads .env, cleans up after itself),
                               # then checks that each sample only has keys the live results have
```

`scripts/generate.mjs` lists the operations the integration exposes (`PUBLISHED_OPERATIONS`) and holds the naming and description overrides on top of the spec. Fix problems in the generator, never in the generated files: CI regenerates and fails when the output differs. Action keys are stored in users' Zaps, so renaming one breaks existing Zaps.

The runtime lives in `lib/`: `operations.js` turns the generated descriptors into Zapier actions, `run.js` builds and sends the requests, `convert.js` parses mapped values back into JSON. Triggers are written by hand in `triggers/`. The tests in `test/` validate the app definition with the same schema Zapier uses and assert the requests each action sends.

The `generate` workflow is run by hand from the Actions tab. It fetches the spec, regenerates the actions and opens a pull request when it changed; its `title` input becomes the commit title and so the release note. Releases are made by semantic-release from the commit messages on `main` (`feat:` for a minor version, `fix:` for a patch) and pushed to Zapier with `zapier-platform push`, using the `ZAPIER_DEPLOY_KEY` repository secret.

## Compatibility

Built on `zapier-platform-core` 19. Development requires Node.js 24, as pinned in `.nvmrc`.

## Resources

- [Zapier Platform CLI documentation](https://docs.zapier.com/platform/build-cli/overview)
- [bundle.social API reference](https://info.bundle.social/api-reference/introduction)
- [bundle.social OpenAPI spec](https://api.bundle.social/swagger-json)
