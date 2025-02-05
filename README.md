```ascii
       __   __    __  .______    __    __         __       ___       ______     _______.
      |  | |  |  |  | |   _  \  |  |  |  |       |  |     /   \     /      |   /       |
      |  | |  |  |  | |  |_)  | |  |__|  |       |  |    /  ^  \   |  ,----'  |   (----`
.--.  |  | |  |  |  | |   ___/  |   __   | .--.  |  |   /  /_\  \  |  |        \   \    
|  `--'  | |  `--'  | |  |      |  |  |  | |  `--'  |  /  _____  \ |  `----.----)   |   
 \______/   \______/  | _|      |__|  |__|  \______/  /__/     \__\ \______|_______/    
                                                                                    
```

# Just Use Plain Html, Javascript, and CSS; Stupid.

## A web site framework

Create websites with near-real-time feedback with your code to the left (or right) and a browser to the right (or left). As you edit the code, the page updates, reflecting the changes.

- Use HTML or Markdown documents.
- Write vanilla Javascript and CSS.
- Generates a static site under `_site`.
- If there's a `.mjs` file at the same level as the `.html/.md` file and it exports a default object with `get | post | put |delete | head | options | trace`, with a `route`, than that method gets executed before the `.html/.md` file is rendered and served.
- A WebSocket connection is opened and all file changes trigger a page to be re-rendered, set to the browser, where `morphdom` hot-reloads the DOM.

The name is a play on the KISS Principle (Keep It Simple Stupid). It's super hard to keep things simple, the name is a reminder to keep trying.

# Target Audience(s)

- **Learning web develoment basics** - Use this tool to quickly build a web page with a short feedback loop. You want to code HTML and quickly see what happens. You're learning Javascript and want to get into an fast interative cycle to see how things work on the browser.
- **Building websites without frameworks** - Build a ton of websites with just HTML, Javascript and CSS.
- **Curmudgeonly Neighbor Web Developer** - You're so mad at everyone using frameworks and you refuse to use them to build websites.

# Architecture

- Node.js web [server](server.mjs).
- [Socket.io](pages/layout.html) for comms when a file is updated.
- [Morphdom](pages/js/HotReloader.mjs) code which gets the `file changed` message from the server and diffs the DOM, swapping out any changed elements.

# Use

Use the latest version of [Node.js](https://nodejs.org). As of writing, it's `v23.6.1`.

```sh
npm i
node --run start
```

## With Logging

```sh
DEBUG=<debug|info|warn|error> node --run start
```

# License

[MIT](https://opensource.org/license/MIT)

# App Design

## Be Fast

A request loads a static HTML page. Which means we have to generate static HTML files and put them in a folder where they can be piped to the response.

## Short Developer Feedback Loop

When a file is modified, the static site generation kicks in and generates the mapped static file.

The generated output is then sent to the browser a user is on that page, for DOM diffing.

## Pages

A page consists of an HTML and a `.mjs` javascript file with the same name. e.g. `index.html` && `index.mjs`, in the same folder. The Javascript file will be `import`ed and passed as the `context` object to the templating engine. The templating engine uses [Template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals).


```html
<!-- index.html -->
<h1>${title}</h1>
```

```js
// index.mjs
export default {
      title: 'Home Page',
      route: /^index.html/,
      get(request) {
            return new Response('ok')
      },
      post(request) {
            return new Response('created', 201)
      }
}
```

If methods named after the HTTP methods are defined in the context object, they will be executed if the route matches (`route.match(url.pathname)`) the `IncomingMessage` URL. Just as long as the `route` property has a method called `match` on it, it'll work. Doesn't have to be a RegExp. Just has to have a `match` method that returns `truthy`.

## Layouts

Define a layout for the HTML page by including a `layout` property in the module. The `layout.html` file has a to have `${body}` in it for the page to render into.

```js
// index.mjs
export default {
      layout: 'pages/layout.html'
}
```

# Architecture

## Scenarios

- Static file exists for URL
- Static file exists for URL, but is sourced from a Markdown file

### Instructions

- On bootup
 - Read all markdown files
  - transform to HTML
  - import any same named javascript files for the context
  - Run through templating engine
  - Write output to _site
 - Read all the pages
  - import any same named javascript files for the context
  - Run through templating engine
  - Write output to _site
- On request
 - Lookup URI in Route table and run through templating engine if there's a match
 - if no route is found and URI exists as file, pipe file to response
   - Send output back in response
   - Save HTML file to _site
- On socket (file has changed)
 - Lookup URI in Route table and run through templating engine if there's a match
  - Send output back in connection
  - Save HTML file to _site
 - if no route is found and file exists
  - Render page
  - Send output back in connection
  - Save HTML file to _site
- HotReload uses morphdom to diff the DOM for hot-reloading
