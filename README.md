```ascii
       __   __    __  .______    __    __         __       ___       ______     _______.
      |  | |  |  |  | |   _  \  |  |  |  |       |  |     /   \     /      |   /       |
      |  | |  |  |  | |  |_)  | |  |__|  |       |  |    /  ^  \   |  ,----'  |   (----`
.--.  |  | |  |  |  | |   ___/  |   __   | .--.  |  |   /  /_\  \  |  |        \   \    
|  `--'  | |  `--'  | |  |      |  |  |  | |  `--'  |  /  _____  \ |  `----.----)   |   
 \______/   \______/  | _|      |__|  |__|  \______/  /__/     \__\ \______|_______/    
                                                                                    
```

# Just Use Plain Html, Javascript, and CSS; Stupid.

A play on the KISS Principle (Keep It Simple Stupid), even though it's super hard to keep things simple. Alas, we keep trying.

Create websites with near-real-time feedback with your code to the left (or right) and a browser to the right (or left). As you edit the code, the page updates, reflecting the changes.

It's Hot-Reloading the DOM.

# Target Audience(s)

- **Learning web develoment basics** - Use this tool to quickly build a web page with a short feedback loop. You want to code HTML and quickly see what happens. You're learning Javascript and want to get a into an interative cycle to see how things work on the browser.
- **Building websites without frameworks** - Build a ton of websites with just HTML, Javascript and CSS.
- **Curmudgeonly Neighbor Web Developer** - You're so mad at everyone using frameworks and you refuse to use them to build websites.

# Architecture

- Node.js web [server](server.mjs).
- [Socket.io](public/HotReloader.mjs) for comms when a file is updated.
- [Morphdom](public/layout.html) code which gets the `file changed` message from the server and diffs the DOM, swapping out any changed elements.

# Use

Use the latest version of [Node.js](https://nodejs.org). As of writing, it's `v22.9.0`.

```sh
npm i
node --run start
```

## With Logging

```sh
DEBUG=hot-reloading:server node --run start
```
# License

[MIT](https://opensource.org/license/MIT)
