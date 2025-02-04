const title = 'Hot <s>Tea</s> DOM Reloading Machinations'
const things = []
for (let i = 10; i >= 0; i--) {
    things.push(i)
}

export default {
    title,
    things,
    layout: 'pages/layout.html',
    route: new RegExp('^/index.html')
}

