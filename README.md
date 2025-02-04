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

## Code Locality

HTML, CSS, client side and server side javascript in a single file. The templating engine allows you to write server side code in a `script` tag with a `server` attribute.

```html
<script server>
      console.log('this will log on the server console', context.req, context.res)
      export default {
            title: 'Set a property that can be referenced in the HTML (and the Layout HTML page via {title}')
      }
</script>
```

The `req` and `res` objects will be available in the javascript code.

## Layouts

Define a layout for the HTML page by including a `layout` property in the module.

```html
<script server>
      export default {
            layout: 'public/mainlayout.html'
      }
</script>
```

## Pretty URIs (URI Routing)

Define the pages route by including a `route` property in the module.

```html
<script server>
      export default {
            route: new RegExp('/blog/(?<year>{4})/(?<slug>.*)?')
      }
</script>
```

# Architecture

## Scenarios

- Static file exists for URL
- Static file exists for URL, but is sourced from a Markdown file

### Instructions

- On bootup
 - Read all markdown files
  - transform to HTML
  - Compile and execute the scripts
  - Run through templating engine
  - Write output to _site
 - Read all the pages
  - Compile and execute the scripts
  - Run through templating engine
  - Write output to _site
- On request
 - if URI exists as file, pipe file to response
 - Lookup URI in Route table and run through templating engine if there's a match
   - Send output back in response
   - Save HTML file to wwww
- On socket (file has changed)
 - Lookup URI in Route table and run through templating engine if there's a match
  - Send output back in connection
  - Save HTML file to www
