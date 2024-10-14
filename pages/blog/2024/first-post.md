# My First Post with Juphjacs

I'm sure there's many strategies for designing software. I follow my nose by implementing a funciontality at a time.

A consequence of this approach is convoluted software where responsibilities are spread out across the code base, with little cohesion around a dimension that makes sense.

With this approach, I'm using code to think. I have a vision in mind of me utilizing a web framework to build a fast website, with a fast development feedback loop. I see the effects of my code changes right away so I can iterate to the functionality or the look I want.

# My Goals

- Code in HTML, CSS and Javascript. Build my own web framework with my own values.
- Make it fast by just serving up static html files.
- Make the developer feedback loop fast. If I change a file and that page is loaded in the browser, update it with dom diffing. Hot Reloading for those of us that want to build our own web framework and not use React, Vue, Svelte or any other library that transpiles into HTML.
- Implement Code Locality by having the server side Javascript in the HTML page with a script tag with a server attribute.

I'm seeing the code scattering.

## Concepts

- Html pages
- Server side elements in the HTML
- Static site generation
- Regular HTTP requests
- Socket connections
- Client-server interaction over HTTP and Socket connection

# Class Architecture

- Template
- TemplateMarkdown
- ChockidarWannabee - file watching
- Code out the concept of layouts from watching the files

<script server>
    export default {
        title: 'Common Software Design Strategy',
        layout: 'pages/blog/layout.html',
        excerpt: 'Many strategies for designing software. One is to follow your nose by implementing a functionality at a time, serially.'
    }
</script>