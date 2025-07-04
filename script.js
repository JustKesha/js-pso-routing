class SwarmEntity {
    constructor(x, y, speed, directionAngle, objective, objectivesApproximateDistance, connectedRoad) {
        this.x = x != undefined ? x : 0;
        this.y = y != undefined ? y : 0;
        this.directionAngle = directionAngle != undefined ? directionAngle : parseFloat((Math.random() * 2 * Math.PI).toFixed(10));
        this.objective = objective != undefined ? objective : 0;
        this.objectivesApproximateDistance = objectivesApproximateDistance != undefined ? objectivesApproximateDistance : [];
        this.speed = speed != undefined ? speed : .1;
        this.connectedRoad = connectedRoad;
    }
}

class SwarmObjective {
    constructor(x, y, directionAngle) {
        this.x = x != undefined ? x : 0;
        this.y = y != undefined ? y : 0;
        this.cooldown = 0;
        this.directionAngle = directionAngle != undefined ? directionAngle : parseFloat((Math.random() * 2 * Math.PI).toFixed(2));
    }
}
class SwarmConnection {
    constructor(entityIndexA, entityIndexB, status) {
        this.entityIndexA = entityIndexA;
        this.entityIndexB = entityIndexB;
        this.status = status;
    }
}

class SwarmBarrier {
    constructor(pointA, pointB) {
        this.points = [ pointA, pointB ];
    }
}

class Swarm {
    constructor( mapWidth = 10, mapHeight = 10, communicationRadius = null, entities = null, objectives = null,
        barriers = null, firstFrameStill = true, firstFrameDoubl = true ) {
        this.entities = entities || [];
        this.objectives = objectives || [];
        this.barriers = barriers || [];
        this.connections = [];
        this.roads = [];
        this.movingByRoads = false;
        this.firstPointFound = false;
        this.firstFrameStill = firstFrameStill;
        this.firstFrameDoubl = firstFrameDoubl;

        this.entity = {
            hitbox: {
                height: 1,
                width: 1
            },
            collision: true,
            logConnections: false,
            communicationRadius: communicationRadius || 25,
            onlyLogGoodConnections: false,
        };
        this.plane = {
            xMin: 0,
            yMin: 0,
            xMax: mapWidth,
            yMax: mapHeight,
            collideWalls: true
        };
        this.objective = {
            hitbox: {
                width: .1,
                height: .1
            },
            cooldownFrames: 1,
            speed: 0
        }
        this.isFirstFrame = true;

        this.entityAngleChangeChance = .25;
        this.entityAngleChangeMultiplier = .25;

        this.objectiveAngleChangeChance = .25;
        this.objectiveAngleChangeMultiplier = .25;
    }

    wallsCollision(x, y, directionAngle, w, h){
        let newX = x, newY = y, newAngle = directionAngle;
        let hitVertically = false, hitHorizontally = false;

        if(this.plane.collideWalls) {
            if(x - w/2 < this.plane.xMin){
                hitHorizontally = true;
                newX = this.plane.xMin + w/2;
            } else
            if(x + w/2 > this.plane.xMax){
                hitHorizontally = true;
                newX = this.plane.xMax - w/2;
            }
    
            if(hitHorizontally)
                newAngle = Math.PI - directionAngle;
    
            if(y - h/2 < this.plane.yMin){
                hitVertically = true;
                newY = this.plane.yMin + h/2;
            } else
            if(y + h/2 > this.plane.yMax){
                hitVertically = true;
                newY = this.plane.yMax - h/2;
            }
    
            if(hitVertically)
                newAngle = 2 * Math.PI - directionAngle;

        } else {
            if(x - w/2 > this.plane.xMax){
                newX = this.plane.xMin - w/2;
            } else
            if(x + w/2 < this.plane.xMin){
                newX = this.plane.xMax + w/2;
            }
    
            if(y - h/2 > this.plane.yMax){
                newY = this.plane.yMin - h/2;
            } else
            if(y + h/2 < this.plane.yMin){
                newY = this.plane.yMax + h/2;
            }
        }

        return [newX, newY, newAngle];
    }

    rectCollision(Ax, Ay, Aheight, Awidth, Bx, By, Bwidth, Bheight) {
        return (
            !(Ax + Awidth < Bx) &&
            !(Ax > Bx + Bwidth) &&
            !(Ay + Aheight < By) &&
            !(Ay > By + Bheight)
        );
    }

    lineLineCollision(x1, y1, x2, y2, x3, y3, x4, y4) {
        let uA = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
        let uB = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
        if(uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1) { return true; } return false;
    }
    
    lineRectCollision(x1, y1, x2, y2, rx, ry, rw, rh) {
        let left = this.lineLineCollision(x1,y1,x2,y2, rx,ry,rx, ry+rh);
        let right = this.lineLineCollision(x1,y1,x2,y2, rx+rw,ry, rx+rw,ry+rh);
        let top = this.lineLineCollision(x1,y1,x2,y2, rx,ry, rx+rw,ry);
        let bottom = this.lineLineCollision(x1,y1,x2,y2, rx,ry+rh, rx+rw,ry+rh);
      
        if(left || right || top || bottom) {
          return true;
        } return false;
    }

    calcNextPosition(x, y, directionAngle, speed) {
        return { 
            x: Math.cos(directionAngle) * speed + x,
            y: Math.sin(directionAngle) * speed + y,
        }
    }

    lineToPointDelta(x, y, startX, startY, endX, endY) {
        let Dx = endX - startX;
        let Dy = endY - startY;
        return Math.abs(Dy*x - Dx*y - startX*endY+endX*startY)/Math.sqrt(Math.pow(Dx, 2) + Math.pow(Dy, 2));
    }

    pointOnLine(x, y, startX, startY, endX, endY) {
        const Delta = this.lineToPointDelta(x, y, startX, startY, endX, endY);
        const Off = 1;
        if(Delta <= Off && Delta >= Off * -1) return true;
        return false;
    }

    pointToPoitDist(pointA, pointB) {
        return Math.sqrt((pointA.x - pointB.x) ** 2 + (pointA.y - pointB.y) ** 2);
    }

    closestPoint(point, points) {
        let minDistPointIndex;
        let minPointDist = Infinity;
        for(let index = 0; index < points.length; index++) {
            const anotherPoint = points[index];
            const distance = this.pointToPoitDist(point, anotherPoint);
            if(distance < minPointDist) {
                minPointDist = distance;
                minDistPointIndex = index;
            }
        }
        return minDistPointIndex ?? 0;
    }

    dist(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2));
    }

    angle(cx, cy, ex, ey) {
        var dy = ey - cy;
        var dx = ex - cx;
        var theta = Math.atan2(dy, dx);
        theta *= 180 / Math.PI;
        return theta;
    }

    findClosestAngle(current, angles = []) {
        angles.sort((a, b) => a-b);

        let anticlockangle, anticlockscore = 0;
        for(i = current; i > -360; i -= 1) {
            if(angles.find(element => element === i)) {
                anticlockangle = i;
                break;
            }
            anticlockscore++;
        }
        if(anticlockangle === undefined) anticlockangle = angles[angles.length - 1];

        let clockangle, clockscore = 0;
        for(i = current; i < 360; i += 1) {
            if(angles.find(element => element === i)) {
                clockangle = i;
                break;
            }
            clockscore++;
        }
        if(clockangle === undefined) clockangle = angles[0];

        return anticlockscore > clockscore ? clockangle : anticlockangle;
    }
    randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
    randomiseEntityTargets() {
        this.entities.forEach(entity => {
            entity.objective = this.randInt(0, this.objectives.length-1);
        });
    }

    frame() {
        this.connections = [];

        this.objectives.forEach(objective => {
            if(objective.cooldown) objective.cooldown--;

            if(Math.random() < this.objectiveAngleChangeChance) {
                objective.directionAngle += Math.random() * this.objectiveAngleChangeMultiplier * this.objective.speed * (Math.random()>=.5?1:-1);
            }

            [objective.x, objective.y, objective.directionAngle] = this.wallsCollision(objective.x, objective.y, objective.directionAngle, this.objective.hitbox.width, this.objective.hitbox.height);

            objective.x = Math.cos(objective.directionAngle) * this.objective.speed + objective.x;
            objective.y = Math.sin(objective.directionAngle) * this.objective.speed + objective.y;
        });
        
        for(let entityIndex = 0; entityIndex < this.entities.length; entityIndex++){
            let entity = this.entities[entityIndex];
            let nextEntityPos = this.calcNextPosition(entity.x, entity.y, entity.directionAngle, entity.speed);

            if(Math.random() < this.entityAngleChangeChance) {
                entity.directionAngle += Math.random() * this.entityAngleChangeMultiplier * (Math.random()>.5?1:-1);
            }
            
            for(let objectiveIndex = 0; objectiveIndex < this.objectives.length; objectiveIndex++){
                let objective = this.objectives[objectiveIndex];

                if(!entity.objectivesApproximateDistance[objectiveIndex]) entity.objectivesApproximateDistance[objectiveIndex] = Infinity;
                entity.objectivesApproximateDistance[objectiveIndex] += 100;

                if(this.rectCollision(
                    entity.x-this.entity.hitbox.width/2, entity.y-this.entity.hitbox.height/2, this.entity.hitbox.width, this.entity.hitbox.height,
                    objective.x-this.objective.hitbox.width/2, objective.y-this.objective.hitbox.width/2, this.objective.hitbox.width, this.objective.hitbox.height
                )){
                    this.firstPointFound = true;
                    entity.objectivesApproximateDistance[objectiveIndex] = 0;

                    if(objectiveIndex == entity.objective){
                        entity.objective = objectiveIndex + 1;
                        if(entity.objective >= this.objectives.length) entity.objective = 0;
                        entity.directionAngle = entity.directionAngle + Math.PI;
                        objective.cooldown = this.objective.cooldownFrames;
                    }
                }
            }

            for(let i = 0; i < this.barriers.length; i++) {
                let wall = this.barriers[i];
                if(this.lineLineCollision(
                    wall.points[0].x, wall.points[0].y, wall.points[1].x, wall.points[1].y,
                    entity.x, entity.y, nextEntityPos.x, nextEntityPos.y
                )){
                    nextEntityPos = this.calcNextPosition(entity.x, entity.y, entity.directionAngle, entity.speed * -1);
                    entity.directionAngle += 360;
                }
            }

            if(!(this.firstFrameStill && this.isFirstFrame)) {
                entity.x = nextEntityPos.x;
                entity.y = nextEntityPos.y;
            }

            [entity.x, entity.y, entity.directionAngle] = this.wallsCollision(entity.x, entity.y, entity.directionAngle, this.entity.hitbox.width, this.entity.hitbox.height);
        }

        if(this.firstPointFound)
        for(let entityIndex = 0; entityIndex < this.entities.length; entityIndex++){
            let entity = this.entities[entityIndex];

            for(let neighborIndex = 0; neighborIndex < this.entities.length; neighborIndex++){
                let neighbor = this.entities[neighborIndex];

                if(entityIndex != neighborIndex)
                if((neighbor.x - entity.x)**2 + (neighbor.y - entity.y)**2 <= this.entity.communicationRadius**2){

                    let barreierBetween = false;
                    if(!this.movingByRoads)
                    for(let i = 0; i < this.barriers.length && !barreierBetween; i++) {
                        let wall = this.barriers[i];
                        if(this.lineLineCollision(
                            wall.points[0].x, wall.points[0].y, wall.points[1].x, wall.points[1].y,
                            neighbor.x, neighbor.y, entity.x, entity.y
                        )){
                            barreierBetween = true;
                        }
                    }
                    if(!barreierBetween) {
                        
                        let connectionStatus = 'CONNECTION_DEFAULT';
                        for(let objectiveIndex = 0; objectiveIndex < this.objectives.length; objectiveIndex++){

                            const neighborDist = this.dist(neighbor.x, neighbor.y, entity.x, entity.y);
                            if(neighbor.objectivesApproximateDistance[objectiveIndex] + neighborDist < entity.objectivesApproximateDistance[objectiveIndex]){
                                entity.objectivesApproximateDistance[objectiveIndex] = neighbor.objectivesApproximateDistance[objectiveIndex] + neighborDist;
                                connectionStatus = 'CONNECTION_SUCCESSFUL';
                                if(entity.objective == objectiveIndex){
                                    connectionStatus = 'CONNECTION_USEFUL';
                                    entity.directionAngle = Math.atan2(neighbor.y-entity.y, neighbor.x-entity.x);
                                }
                            }
                        }

                        if(this.entity.logConnections) {
                            if(this.entity.onlyLogGoodConnections && connectionStatus == 'CONNECTION_DEFAULT')
                                continue;

                            this.connections.push(new SwarmConnection(entityIndex, neighborIndex, connectionStatus));
                        }
                    }
                }
            }
        }
        
        let wasFirstFrame = this.isFirstFrame;
        this.isFirstFrame = false;

        if(wasFirstFrame && this.firstFrameDoubl)
            this.frame();
    }
}