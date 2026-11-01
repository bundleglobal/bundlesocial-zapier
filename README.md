# bundle.social for Zapier

This is the [Zapier](https://zapier.com) integration for [bundle.social](https://bundle.social). It covers the whole publishing workflow from your Zaps: set up teams, connect social accounts, upload media, schedule posts to 15 social networks and track how they perform, with unlimited social accounts.

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

- **Team**, **Social Account** and **Upload** fields are dropdowns loaded from your organization; you can also map an ID from an earlier step.
- **Connect Social Account** returns a URL. Open it to sign in to the social network and the account is connected to the team.
- **Create Post** has one settings section per platform (*TikTok Settings*, *Instagram Settings*, ...). Only the sections of the platforms picked in **Social Account Types** are shown. When that field is mapped from an earlier step, every section is shown.
- Media goes in two steps: upload it with **Upload File** (a file from an earlier step, or a URL) or **Upload From URL**, then map the returned `id` into **Upload IDs** of the post. **Upload From URL** is the best fit for public links and long videos, because bundle.social downloads the file itself.
- **Upload File** takes files up to 90 MB. **Upload Large File** takes files up to 5 GB: it sends the file straight to storage and adds it to the media library in one step. The *Initialize*, *Finalize* and *Multipart* upload actions expose the individual steps for files above 5 GB or custom flows.
- **Get Post Analytics** takes the **Post ID** together with the **Platform Type** the post went out on.
- Every action with a request body has **Specify Body**. Switch it to **Using JSON** to send the raw request body, which is handy when the body comes from an earlier step.
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

## Triggers

Triggers check bundle.social on Zapier's polling interval.

| Trigger | Fires when | Endpoint |
|---|---|---|
| Post Published | a post finishes publishing | `GET /api/v1/post/?status=POSTED` |
| Post Failed | a post fails to publish | `GET /api/v1/post/?status=ERROR` |
| New Team | a team is created in your organization | `GET /api/v1/team/` |
| New Social Account | a social account is connected to a team | `GET /api/v1/team/` |

The post triggers can be narrowed to posts on specific platforms, New Social Account to one team.

## Actions

<!-- actions:start -->

41 actions, generated from the bundle.social OpenAPI spec.

| Action | What it does | Endpoint |
|---|---|---|
| Get Post Analytics | Retrieves engagement metrics such as likes, comments, shares and views for a published post. | `GET /api/v1/analytics/post` |
| Get Social Account Analytics | Retrieves profile metrics such as followers, reach and impressions for a connected social account. | `GET /api/v1/analytics/social-account` |
| Get Comments Usage (Organization) | Retrieves how many comments your organization has used against its plan limit this billing period. | `GET /api/v1/organization/usage/comments` |
| Get Daily Limits Usage (Organization) | Retrieves how many posts a social account has published on a given day against the network's daily cap. | `GET /api/v1/organization/usage/daily-limits` |
| Get Imports Usage (Organization) | Retrieves the post history import usage of each social account, by team or platform. | `GET /api/v1/organization/usage/imports` |
| Get Organization | Retrieves your bundle.social organization with its plan details. | `GET /api/v1/organization/` |
| Get Posts Usage (Organization) | Retrieves how many posts your organization has used against its plan limit this billing period. | `GET /api/v1/organization/usage/posts` |
| Get Uploads Usage (Organization) | Retrieves how much upload capacity your organization has used against its plan limit this billing period. | `GET /api/v1/organization/usage/uploads` |
| Create Post | Schedules a post, or publishes it right away, to one or more connected social accounts. | `POST /api/v1/post/` |
| Delete Post | Permanently deletes a post from bundle.social. | `DELETE /api/v1/post/{id}` |
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
bash scripts/smoke-test.sh     # every trigger and action against the real API (reads .env, cleans up after itself)
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
