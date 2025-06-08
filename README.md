# 🗺️ Routing by PSO - JS

### Overview

This is a simple script written JavaScript that helps solve routing problems using [particle swarm optimization](https://en.wikipedia.org/wiki/Particle_swarm_optimization),<br>
It supports multiple points routing and barriers.

Here's a simple visualisation of the code example below using canvas:

<img alt="Canvas Animation GIF" width="250" height="250" src="preview.gif" />

For more complex scenarios check out the editor I built at [justkesha.github.io/routing-by-pso](https://justkesha.github.io/routing-by-pso),<br>
It includes a wide range of settings and brushes, as well as an [OpenStreetMap API](https://en.wikipedia.org/wiki/OpenStreetMap) integration.

### Usage

Here's a basic example with a 1 point search:
```js
var swarm = new Swarm(10, 10);
var speed = .5;

// Evenly distributing particles
for(let i = 1; i < swarm.plane.xMax; i += 1)
    for(let j = 1; j < swarm.plane.yMax; j += 1)
        swarm.entities.push(new SwarmEntity(i, j, speed));

// Adding 1 point to search at 1:1
swarm.objectives.push(new SwarmObjective(1, 1));

// Repeat 30 iterations
for(let i = 0; i < 30; i += 1)
    swarm.frame();
```

We can then check the average particle position to see if it works:
```js
console.log((arr => [
    arr.reduce((sum, obj) => sum + obj.x, 0) / arr.length,
    arr.reduce((sum, obj) => sum + obj.y, 0) / arr.length
])(swarm.entities));
```
Iteration 0: `[5, 5]`
Iteration 30: `[1.0845236605545332, 1.1649163955747983]`
