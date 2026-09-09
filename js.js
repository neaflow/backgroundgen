"use strict";
window.onerror = alert;

let theCurrentLevel = null;
let theCurrentPlayer = null;
let theCurrentDisplay = null;
let isDropping = false;
let isPuttingOn = false;
let isRemoving = false;
let pendingAttackTarget = null; //when  player is asked "attack this ignore/following monster? Y/N" the monster is stored here
const visRad = 8;//how many tiles the player can see in any direction
const dungeonDepth = 5;//how many levels deep the dungeon goes (the crown is on the deepest level)

const traits = {
    pyromancer: 
    {
        name: "Pyromancer",
        element: "pyro",
        maxHpBonus: 0,
        atkBonus: 2,
        defBonus: 0,
        cantWeild: ["Armour", "Claymore"],
        desc: "uses pyro (fire) to deal 2 extra damage, but can't wear armour or use a claymore"
    },
    cryomancer: 
    {
        name: "Cryomancer",
        element: "cryo",
        maxHpBonus: 10,
        atkBonus: 1,
        defBonus: 1,
        cantWeild: ["Claymore"],
        desc: "uses cryo (ice) to gain 10 HP, and an attack and defence bonus of 1, but can't use a claymore"
    },
    hydromancer: 
    {
        name: "Hydromancer",
        element: "hydro",
        maxHpBonus: 30,
        atkBonus: -1,
        defBonus: 1,
        cantWeild: ["Armour"],
        desc: "uses hydro (water) to gain 30 HP and 1 defence, but loses 1 attack and can't wear armour"
    },
    electromancer: 
    {
        name: "Electromancer",
        element: "electro",
        maxHpBonus: -20,
        atkBonus: 4,
        defBonus: 0,
        cantWeild: ["Armour", "Shield"],
        desc: "uses electro (electricity) to gain 4 attack, but loses 20 HP and can't wear armour and weild a shield"
    },
    aeromancer: 
    {
        name: "Aeromancer",
        element: "anemo",
        maxHpBonus: 5,
        atkBonus: 2,
        defBonus: 0,
        cantWeild: ["Armour", "Claymore"],
        desc: "uses anemo (wind) to gain 5 Hp and 2 attack but can't wear armour or use a claymore"
    },
    geomancer: 
    {
        name: "Geomancer",
        element: "geo",
        maxHpBonus: 15,
        atkBonus: 0,
        defBonus: 2,
        cantWeild: [],
        desc: "uses geo (earth) to gain 15 HP and 2 defence."
    },
    dendromancer: 
    {
        name: "Dendromancer",
        element: "dendro",
        maxHpBonus: 20,
        atkBonus: 1,
        defBonus: 1,
        cantWeild: ["Armour"],
        desc: "uses dendro (nature) to gain 20 HP, 1 attack, and 1 defence, but can't wear armour"
    }
};


const effectiveness =//lookup table for what elements are effective against what elements
{
    pyro:    { pyro: 1, hydro: 0.5, electro: 1, cryo: 1, anemo: 2, geo: 1, dendro: 1 },
    hydro:   { pyro: 2, hydro: 1, electro: 1, cryo: 1, anemo: 1, geo: 1, dendro: 0.5 },
    electro: { pyro: 1, hydro: 1, electro: 1, cryo: 0.5, anemo: 1, geo: 1, dendro: 2 },
    cryo:    { pyro: 1, hydro: 1, electro: 2, cryo: 1, anemo: 1, geo: 0.5, dendro: 1 },
    anemo:   { pyro: 0.5, hydro: 1, electro: 1, cryo: 1, anemo: 1, geo: 2, dendro: 1 },
    geo:     { pyro: 1, hydro: 1, electro: 1, cryo: 2, anemo: 0.5, geo: 1, dendro: 1 },
    dendro:  { pyro: 1, hydro: 2, electro: 0.5, cryo: 1, anemo: 1, geo: 1, dendro: 1 }
};//every element is strong against exactly one and weak against exactly one



const messageLog = [];//the output box should log messages (20 i've decided) instead of just showing one
function logMessage(message) {
    messageLog.push(message);//adds the message to the end of the array
    if (messageLog.length > 20) {
        messageLog.shift(); // deletes the 21st oldest message, keeping 20
    }
    const output = document.getElementById('outputtext');
    if (output)//failsafe
    {
        output.innerText = messageLog.join("\n");//new line character beetween each line
        output.scrollTop = output.scrollHeight; // Auto-scroll to the bottom
    }
}

function updateHealthDisplayer() {//updates the player's current health on the display
    const healthBox = document.getElementById("hb");
    if (!healthBox) return;//failsafe
    if (theCurrentPlayer)//if there is a player
    {
        const hpct = Math.round((theCurrentPlayer.hp / theCurrentPlayer.maxHp) * 100);
        healthBox.innerText = "Health: " + hpct + "%";
    } else {
        healthBox.innerText = "Health: -";//display nothing for health if tehre is no player
    }
}

function updateFloorIndicator()//show which floor the player is on
{
    const floorBox = document.getElementById("floor-indicator");
    if (!floorBox) return;//failsafe
    if (theCurrentLevel)//if there's a level
    {
        floorBox.innerText = "Floor: " + theCurrentLevel.depth;
    }
    else
    {
        floorBox.innerText = "Floor: -";//display nothing if no level
    }
}

function updateEquipmentDisplayer()//updates the box that shows what the player has equipped
{
    const equipBox = document.getElementById("equipment-list");
    if (!equipBox) return;//failsafe

    if (!theCurrentPlayer)//if there is no player (like after dying)
    {
        equipBox.innerText = "Equipment: -";
        return;
    }

    let text = "Equipment:\n";//start the text with a heading line

    //these slots have one item each unlike hands
    const oneItemSlots = ["head", "body", "finger", "feet"];//all the single-item slots (hands are handled separately)
    for (const slot of oneItemSlots)//loop through each slot
    {
        const item = theCurrentPlayer.equipment.get(slot);//what is in this slot (undefined if empty)
        if (item)//if there is an item in the slot
        {
            text += slot + ": " + item.constructor.name.toLowerCase() + "\n";//show its name
        }
        else//nothing
        {
            text += slot + ": none\n";
        }
    }

    //two slots for hands
    if (theCurrentPlayer.handItems.length === 0)//if nothing is being held
    {
        text += "hand: none";//none with no newline because it's the last line
    }
    else//if something is being held
    {
        text += "hand: ";
        for (let i = 0; i < theCurrentPlayer.handItems.length; i++)//loop through each held item
        {
            const item = theCurrentPlayer.handItems[i];//get this held item
            const itemName = item.constructor.name.toLowerCase();//the item's name

            //"1 hand" vs "2 hands"
            let handWord = "hand";//singular by default
            if (item.hands !== 1) 
            {
                handWord = "hands";//plural if it takes more than one hand
            }
            text += itemName + " (" + item.hands + " " + handWord + ")";//like "sword (1 hand)"

            if (i < theCurrentPlayer.handItems.length - 1)//if this isn't the last held item
            {
                text += ", ";//separate the items with a comma
            }
        }

        //also show how many of the hand slots are being used total
        let totalHands = 0;//start at zero
        for (const item of theCurrentPlayer.handItems)//loop through each held item
        {
            totalHands += item.hands;//add up how many hands each one takes
        }
        text += "\nhands used: " + totalHands + "/2";
    }

    equipBox.innerText = text;//draw it to the screen
}

function updateTraitDisplayer()//updates the box that shows the player's chosen trait(s)
{
    const traitBox = document.getElementById("traitdisplay");
    if (!traitBox)//failsafe
    {
        return;
    }

    if (!theCurrentPlayer)//no player
    {
        traitBox.innerText = "traits: -";
        return;
    }

    if (theCurrentPlayer.traits.length === 0)//no traits chosen yet
    {
        traitBox.innerText = "none";
        return;
    }

    let text = "Traits:\n";
    for (let i = 0; i < theCurrentPlayer.traits.length; i++)//go through all traits IF it ends up being possible to have multiple traits at some point. futureproofing
    {
        const traitKey = theCurrentPlayer.traits[i];
        const trait = traits[traitKey];//look up the full trait definition
        if (!trait)//failsafe
        {
            continue;
        }
        text += trait.name + " (" + trait.element + ")";//"Pyromancer (pyro)"
        if (i < theCurrentPlayer.traits.length - 1)//separate multiple traits with a newline (not  last one)
        {
            text += "\n";
        }
    }
    traitBox.innerText = text;//draw it to the screen
}

const helpbutton = document.getElementById('helpbutton');
if (helpbutton) 
{
    helpbutton.addEventListener('click', () => {
        logMessage(
            "-------------------------\n" +
            "Controls:\n" +
            "WASD to move (or attack if moving into a monster, which prompts you to press Y to confirm)\n" +
            ", to pick up items\n" +
            "< (shift + ,) to climb the stairs\n" +
            "> (shift + .) to descend the stairs\n" +
            "I to manually show inventory (you shouldn't need to)\n" +
            "Q to drop an item\n" +
            "P to start weilding an item\n" +
            "R to remove an item you're wearing / wielding\n" +    
            "The goal is to find the crown (♕) at the bottom and climb back up to the top level\n"+
            "-------------------------"
        );
    });
}

const submitbutton = document.getElementById('submitbutton');
if (submitbutton) {
    const inputbox = document.getElementById('inputbox');
    const outputtext = document.getElementById('outputtext');
    const enteryourname = document.getElementById('enteryourname');
    const gamegridtext = document.getElementById('gamegridtext');
    const traittext = document.getElementById('traittext');
    const traitlist = document.getElementById('traitlist');

    let storedData = "";
    let selectedTraitKey = null;//chosen by the player

    //create a button for each trait
    for (const traitKey in traits)
    {
        const trait = traits[traitKey];//the trait definition object
        const btn = document.createElement("button");//make the element (with the css style)
        btn.textContent = trait.name + ": " + trait.desc;//put the trait name and description in the button
        btn.dataset.traitKey = traitKey;//remember which trait this button is for (so the random button can find it)
        btn.addEventListener('click', () => {
            
            for (const other of traitlist.querySelectorAll('button')) 
            {
                other.classList.remove('selected');//deselect
            }
            btn.classList.add('selected');//visually select

            selectedTraitKey = traitKey;//select in code
            if (traittext)//failsafe
            {
                traittext.innerText = "pick your trait (picked: " + trait.name + ")";//update the heading text
            }
        });
        traitlist.appendChild(btn);//place the button into the trait list area
    }

    //random button code
    const randomBtn = document.createElement("button");
    randomBtn.textContent = "random trait";
    randomBtn.addEventListener('click', () => 
    {
        const traitKeys = Object.keys(traits);//all avaliable traits
        const randomKey = traitKeys[uniformrandom(traitKeys.length - 1)];//random one
        //find that trait's button and click it (runs the normal selection code)
        for (const btn of traitlist.querySelectorAll('button'))//get the right button
        {
            if (btn.dataset.traitKey === randomKey) 
            {
                btn.click();//artificial click
                break;
            }
        }
    });
    traitlist.appendChild(randomBtn);//place it in the list below the trait buttons

    //making the enter key also work to submit, mirroring the click behaviour
    inputbox.addEventListener('keydown', (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            submitbutton.click();//click the submit button
        }
    });

    submitbutton.addEventListener('click', () => {
        storedData = inputbox.value;
        if (!selectedTraitKey)//trait is required before starting: refuse and tell the player
        {
            if (traittext)//failsafe
            {
                traittext.innerText = "pick a trait first!";//can't start without a trait
            }
            return;
        }
        inputbox.style.display = 'none';
        enteryourname.style.display = 'none';
        if (traittext)
        {
            traittext.style.display = 'none';//hide the prompt text
        }
        traitlist.style.display = 'none';//hide the trait buttons
        submitbutton.style.display = 'none';
        
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.display = 'grid';//bunch of added space using this and other css changes to make sure long lines in the log don't push content to the right
        }
        console.log(storedData);
        logMessage("hello " + storedData + ", welcome to the dungeon.");//using new log function instead
        const roomdata = createtherooms();//instead of just running the function that creates the room, sitll dothat, but save the data (grid and rooms)
        
        const dungeon = new Dungeon();
        theCurrentLevel = new Level(roomdata.grid);
        theCurrentLevel.parent = dungeon;

        theCurrentPlayer = new Player();
        theCurrentPlayer.name = storedData;
        theCurrentPlayer.applyTrait(selectedTraitKey);//apply the trait
        const chosenTrait = traits[selectedTraitKey];
        logMessage("you are a " + chosenTrait.name + "!");//tell the player what they became
        theCurrentPlayer.parent = theCurrentLevel;
        updateHealthDisplayer();//initially to show the health
        updateFloorIndicator();//initially to show which floor the player is on
        updateEquipmentDisplayer();//show what slots can be equipped into
        updateTraitDisplayer();//show trait in ui
        
        //pick a random room and stand in its middle but try again if there's a pillar (it was possible for overlap before)
        for (let attempt = 0; attempt < 20; attempt++)//20 attempts as per usual
        {
            const startroom = roomdata.rooms[uniformrandom(roomdata.rooms.length - 1)];//random start room
            const px = Math.floor(startroom.left + startroom.width / 2);//middle of the room on the x and y axis
            const py = Math.floor(startroom.top + startroom.height / 2);//

            if (theCurrentLevel.map.get(px, py) === " ")//only spawn on bare floor (pillars "O" and walls "█" block)
            {
                theCurrentPlayer.x = px;//set the player's position
                theCurrentPlayer.y = py;
                break;//found a good spot
            }
        }
        
        const upStairway = new UpStairway();
        upStairway.x = theCurrentPlayer.x;
        upStairway.y = theCurrentPlayer.y;
        upStairway.parent = theCurrentLevel;

        //first down stairs to go to the new levels
        const downStairway = new DownStairway();
        for (let attempt = 0; attempt < 20; attempt++)
        {
            const room = roomdata.rooms[uniformrandom(roomdata.rooms.length - 1)];//random room
            const sx = boundedrandom(room.left + 1, room.right - 2);//random x
            const sy = boundedrandom(room.top + 1, room.bottom - 2);//random y

            const occupied = (theCurrentPlayer.x === sx && theCurrentPlayer.y === sy) ||//not on the player
                theCurrentLevel.children.some(child => child.x === sx && child.y === sy) ||//check through all children of the level
                theCurrentLevel.map.get(sx, sy) !== " ";//clear space

            if (!occupied)//if the spot is free
            {
                downStairway.x = sx;//place it there
                downStairway.y = sy;//
                downStairway.parent = theCurrentLevel;
                break;
            }
        }

        //spawning random items on the level
        const itemClasses = [Coffee, Sword, Lyre, Potion, Sword, Helmet, Armour, Boots, Shield, Claymore, Ring, Cloak];//list of all the items
        const numItems = boundedrandom(5, 10);
        for (let i = 0; i < numItems; i++) {//for the randomly chosen amount of items
            for (let attempt = 0; attempt < 20; attempt++) {//20 attempts
                const itemRoom = roomdata.rooms[uniformrandom(roomdata.rooms.length - 1)];//random room
                const ix = boundedrandom(itemRoom.left + 1, itemRoom.right - 2);//random x in room
                const iy = boundedrandom(itemRoom.top + 1, itemRoom.bottom - 2);//random y in room

                const occupied = (theCurrentPlayer.x === ix && theCurrentPlayer.y === iy) || theCurrentLevel.children.some(child => child.x === ix && child.y === iy) || theCurrentLevel.map.get(ix, iy) !== " ";//check if there's an entity there already or if the tile is a wall/pillar

                if (!occupied) {//if not occupied 
                    const itemClass = itemClasses[uniformrandom(itemClasses.length - 1)];//random item with the name itemClass
                    const item = new itemClass();//create the item
                    item.x = ix;//set location
                    item.y = iy;
                    item.parent = theCurrentLevel;
                    break;
                }
            }
        }

        // adding 3-7 monsters (now just monsters in general instead of just hilichurls) of various goals to random rooms
        const monsterClasses = [hilichurl, hilichurl, hilichurl, slime, treasureHoarder, dog];// added more genshin impact enemies (other than dog). hilichurls are most common
        const numMonsters = boundedrandom(3, 7);
        for (let i = 0; i < numMonsters; i++) {//loop through number of monsters to add
            for (let attempt = 0; attempt < 20; attempt++) {//20 attempts before giving up for each monster
                const monsterRoom = roomdata.rooms[uniformrandom(roomdata.rooms.length - 1)];//getting a random room to place the monster in
                const hx = boundedrandom(monsterRoom.left + 1, monsterRoom.right - 2);//random x in room
                const hy = boundedrandom(monsterRoom.top + 1, monsterRoom.bottom - 2);//random y in room

                const occupied = (theCurrentPlayer.x === hx && theCurrentPlayer.y === hy) ||
                theCurrentLevel.children.some(child => child.x === hx && child.y === hy) ||
                theCurrentLevel.map.get(hx, hy) !== " ";//arrow callback function checking if player is there or any other entities are there, and also now rejecting non-floor in general

                if (!occupied) {//if the position is not occupied
                    const monsterClass = monsterClasses[uniformrandom(monsterClasses.length - 1)];//random monster type but hilichurl is still most common
                    const theMonster = new monsterClass();//create the random monster
                    theMonster.x = hx;
                    theMonster.y = hy;
                    theMonster.parent = theCurrentLevel;

                    // 30% chance for this hilichurl or other monster to get a random item
                    if (uniformrandom(9) < 3) {
                        const itemClass = itemClasses[uniformrandom(itemClasses.length - 1)];
                        const carriedItem = new itemClass();
                        carriedItem.parent = theMonster;

                        //automatically equip if possible
                        if (theMonster.canWear(carriedItem)) 
                        {
                            new putOnAction(theMonster, carriedItem).execute();
                        }
                    }
                    break;
                }
            }
        }

        console.log("Player spawned at:", theCurrentPlayer.x, theCurrentPlayer.y);
        console.log("made ", dungeon);//added earlier because the code wasn't working before
        
        theCurrentDisplay = new Grid(theCurrentLevel.map.width, theCurrentLevel.map.height, " ");//the grid that will be displayed. blank for now
        drawLevel(theCurrentLevel, theCurrentDisplay);//we have to pass in level instead of roomdata.grid becuase roomdata.grid doesn't know the location of the entities
        
        outputtext.classList.add("dungeon");//styling welcome text
        window.focus(); // Release focus from inputs so keyboard controls work instantly
    });
}

function whereVisible(map, playerX, playerY, radius)//the function that calculates where the player can see works by creating a new temprary grid with the same shape and size as the actual grid, but only with true and false for where the player should be able to see
{
    const visibility = new Grid(map.width, map.height, false);//creating new grid with all squares invisible (false) by default
    for (let y = 0; y < map.height; y++)
    {
        for (let x = 0; x < map.width; x++) 
        {
            const dx = x - playerX;
            const dy = y - playerY;
            if (dx * dx + dy * dy < radius * radius)//pythagorean distance formula. only check tiles in range
            {
                //walls and pillars block vision behind them, so only mark it visible if the line to it is clear
                visibility.set(x, y, hasLineOfSight(map, playerX, playerY, x, y));
            }

        }
    }

  //there was a bug where the corner tiles of the map/filled in walls ("█") were being made invisible by the code that doens't allow you to see past you current room's wall. the code until the end of this function fixes that
  let changed = true;
  while (changed)
  {
    changed = false;
    for (let y = 0; y < map.height; y++)
    {
        for (let x = 0; x < map.width; x++) 
        {
            const dx = x - playerX;
            const dy = y - playerY;
            if (dx * dx + dy * dy >= radius * radius) continue;//if this tile is in the circular range of the player's vision
            if (visibility.get(x, y)) continue;//already visible then continue to next tile
            if (!blocksVision(map.get(x, y))) continue;//only apply this to walls and what's behind and next to walls

            let neighborVisible = false;
            for (let ny = y - 1; ny <= y + 1 && !neighborVisible; ny++)//
            {                                                          // go through the 3x3 grid around each square (that of course is in the player's visibility circle)
                for (let nx = x - 1; nx <= x + 1; nx++)                //
                {
                    if (nx === x && ny === y) continue;//this is what skips the tile itself
                    if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;//off the map
                    if (visibility.get(nx, ny))
                    {
                        neighborVisible = true;
                        break;
                    }
                }
            }

            if (neighborVisible)
            {
                visibility.set(x, y, true);//set these walls to visible
                changed = true;
            }
        }
    }
  }

  return visibility;
}

//anything that is not bare floor blocks vision (walls, room borders, pillars, etc.)
function blocksVision(cell) {
    return cell !== " ";
}

//walk along the line from the player to the target tile; if we hit a wall or pillar first, the target is hidden
function hasLineOfSight(map, x0, y0, x1, y1) {
    const lineCells = cellsInLine(x0, y0, x1, y1);
    for (const c of lineCells) {
        if (c.x === x0 && c.y === y0) continue;// player's own tile so don't count it
        if (c.x === x1 && c.y === y1) return true;// only runs if it has gotten to the final tile which is not checked itself 
        if (blocksVision(map.get(c.x, c.y))) return false;// returns false if the blocksvision function returns true
    }
    return true;//failsafe that runs in a scenario where the player's own cell is checked alone
}

//a "supercover" line: when the line passes exactly through a corner, both side tiles are included
//so you can't peek diagonally through the crack between two walls or pillars
function cellsInLine(x0, y0, x1, y1) {
    const cells = [];
    const dx = Math.abs(x1 - x0);//hroizontal distance (always positive) between the first and last x
    const dy = Math.abs(y1 - y0);//vertical distance (always positive) between the first and last y

    let stepX;
    if (x0 < x1) 
    {
        stepX = 1;//moving right
    }

    else
    {
        stepX = -1;//moving left
    }

    let stepY;
    if (y0 < y1) 
    {
        stepY = 1;//moving down
    } 

    else 
    {
        stepY = -1;//moving up
    }
    
    let x = x0;
    let y = y0;
    let ix = 0;
    let iy = 0;
    cells.push({ x, y });//the player's initial tile

    while (ix < dx || iy < dy) {
        // This decision formula compares how "far along" each axis we are.
        const decision = (1 + 2 * ix) * dy - (1 + 2 * iy) * dx;//pos if the invisible line passes through a horizontal line before vertical (and vice versa), 0 if it passes through an intersection of 4 perfectly (draws from middle of current square that the line is on)
        if (decision === 0)//passing through intersection of 4 tiles
        { 
            cells.push({ x: x + stepX, y });
            cells.push({ x, y: y + stepY });
            x = x + stepX;//
            y = y + stepY;//
            ix = ix + 1;  //since we moved on the x and y axis for the visibility line
            iy = iy + 1;  //
            cells.push({ x, y });
        } 
        else if (decision < 0)//going to the horuizontal tile
        {
            x = x + stepX; 
            ix = ix + 1;
            cells.push({ x, y });
        } 
        else//going to the vertical tile
        {
            y = y + stepY; 
            iy = iy + 1;
            cells.push({ x, y });
        }
    }
    return cells;//array of all cells between any two cells in a line
}

//new randomness functions that make the code more readable
function uniformrandom(max) {
    return Math.floor(Math.random() * (max + 1));
}


function boundedrandom(min, max) {
    return uniformrandom(max - min) + min;
}


function drawLevel(level, display) {
    if (!theCurrentPlayer) return;//failsafe
    const visibilityGrid = whereVisible(level.map, theCurrentPlayer.x, theCurrentPlayer.y, visRad);//runs the function that gets the grid of where the player should be able to see

    //get player memory
    let memoryGrid = theCurrentPlayer.memory.get(level);
    if (!memoryGrid)//if no memory yet
    {
        memoryGrid = new Grid(level.map.width, level.map.height, false);//create a new grid filled with false
        theCurrentPlayer.memory.set(level, memoryGrid);//show already explored tiles
    }

    for (let y = 0; y < level.map.height; y++) {
        for (let x = 0; x < level.map.width; x++) {
            if (visibilityGrid.get(x, y))//only paint cells that are visible according to the equivelant vision grid (the "disk")
            {
                memoryGrid.set(x, y, true);//save newly explored tiles
                display.set(x, y, level.map.get(x, y));//visible tiles get shown (still without entities. now if they're supposed to be visible they get shows later in the for loop beginning with for (const child of sortedChildren))
            } 
            else if (memoryGrid.get(x, y))//if in memory show too
            {
                const cell = level.map.get(x, y);//remembered room/hall interior (blank floor) shows as shaded, but walls and pillars stay visible
                if (cell === " ") 
                {
                    display.set(x, y, "▒");//now if you cant see a floor tile even if you've been there, it shows up as ▒ but the walls of remembered areas are still visible. this is so you know the difference between where there's no entities and where you simply can't see
                } 
                else 
                {
                    display.set(x, y, cell);//remembered walls and pillars (once i add that) stay visible
                }
            } 
            else 
            {
                display.set(x, y, "▒");//clear cells outside (shaded so you can see the circle boundary)
            }
        }
    }

    const sortedChildren = level.children.sort((a, b) => {//switched to new priority system which determines what should be displayed if multiple characters overlap
        const priorityA = a.renderPriority || 0;//0 if not defined for whatever reason. here we're telling the sorting algorithm what to sort all the entities by
        const priorityB = b.renderPriority || 0;
        return priorityA - priorityB;//return lowest first in entities list
    });

    for (const child of sortedChildren) {//loop through all the children and display them in order (highest priority is last as they get written last to display, meaning they'll nbe actually displayed)
        if (visibilityGrid.get(child.x, child.y)) {//only draw entities that are visible (if this returns true)
            const symbol = child.symbol || "?";//gets symbol from child class (set to @ for player below) or '?' if there is no symbol
            display.set(child.x, child.y, symbol);//sets it onto the grid that is to be displayed
        }
    }

    const gamegridtext = document.getElementById('gamegridtext');
    if (gamegridtext) {
        gamegridtext.textContent = display.toString();//draw to screen
    }
}

class Grid {
    constructor(width, height, val) {
        // if there's negative values in width or height
        if (width < 0 || height < 0) {
            throw new RangeError("Width and height must be greater than or equal to zero.");
        }
        this.width = width;
        this.height = height;
        this.grid = [];
        // make a row for each column
        for (let y = 0; y < height; y++) {
            let row = [];
            for (let x = 0; x < width; x++) {
                row.push(val);
            }
            this.grid.push(row);
        }
    }
    // get an x and y coordinae's value
    get(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            throw new RangeError("x or y out of bounds");
        }
        return this.grid[y][x];
    }
    // sets an x and y coordinate's value
    set(x, y, newval) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            throw new RangeError("x or y out of bounds");
        }
        this.grid[y][x] = newval;
    }
    // turns the grid into a string with a newline \n between each row
    toString() {
        let lines = [];
        for (let y = 0; y < this.height; y++) {
            lines.push(this.grid[y].join(""));
        }
        return lines.join("\n");
    }

    addroom(room) {
        // corners
        this.set(room.left, room.top, "┌");
        this.set(room.right - 1, room.top, "┐");
        this.set(room.left, room.bottom - 1, "└");
        this.set(room.right - 1, room.bottom - 1, "┘");

        // top and bottom walls
        for (let x = room.left + 1; x < room.right - 1; x++) {
            this.set(x, room.top, "─");
            this.set(x, room.bottom - 1, "─");
        }

        // left and right walls
        for (let y = room.top + 1; y < room.bottom - 1; y++) {
            this.set(room.left, y, "│");
            this.set(room.right - 1, y, "│");
        }

        // interior empty space
        for (let y = room.top + 1; y < room.bottom - 1; y++) {
            for (let x = room.left + 1; x < room.right - 1; x++) {
                this.set(x, y, " ");
            }
        }
    }
}









class Entity {
    constructor() {
        if (new.target === Entity) {
            throw new Error("can't do that");//because you're supposed to make a specific kind of entity ("abstract class")
        }
        this._parent = null; //defaukt parents/childten (nothing)
        this._children = [];
    }

    get renderPriority() {
        return 0;//lowest priority by default so if anything has a (higher) priority set, it'll be displayed over this (such as player)
    }

    get isPortable() {
        return false;//can't take it by defualt
    }

    get parent() {
        return this._parent; //using a private variable so that there's no infinite loop 
    }

    set parent(newparent) {
        if (this._parent === newparent) return; //stop if the parent is already what it was trying t oeb set to

        const oldparent = this._parent;
        this._parent = newparent;

        if (oldparent) { //if there was an old parent, remove it
            oldparent.removechild(this);
        }

        if (newparent) { //if there's a new parent, add it
            newparent.addchild(this);
        }
    }

    get children() {
        return [...this._children];//... means to makea copy. we need that so that if someone tries to mess with the child list directly, it doesn't mess with our internal list.
    }

    addchild(child) {
        if (!this._children.includes(child)) {//only run if this isn't already the case
            this._children.push(child); //adds the child to the children list
            child.parent = this; // 'this' is the entity that is the paprent (th8is sets the child's parent)
        }
    }

    removechild(child) {
        const index = this._children.indexOf(child);
        if (index !== -1) {
            this._children.splice(index, 1);
            child.parent = null;
        }
    }
}

class Dungeon extends Entity { //extends means it's a modified version of the entity class. super(); means to just do the original thing from the normal entity class.
    constructor() {
        super();
    }
    get parent() {
        return super.parent;  //the crown picking up/leaving doesn't work without this (including in the other entity classes)
    }
    set parent(newparent) {
        if (newparent !== null) {
            throw new Error("the parent of a dungeon entity must always be null.");
        }
        super.parent = newparent;
    }
}

class Level extends Entity {
    constructor(mapgrid) {
        super();
        this.map = mapgrid;
        this.depth = 1;//first level is at the top
    }
    get parent() {
        return super.parent;
    }
    set parent(newparent) {
        if (newparent !== null && !(newparent instanceof Dungeon)) {
            throw new Error("the parent of a level must be a dungeon.");
        }
        super.parent = newparent;
    }
}

class Player extends Entity {
    constructor() {
        super();
        this.name = "";
        this.x = 0;
        this.y = 0;
        this.maxHp = 100;
        this.hp = 100;// max by default
        this.atk = 15;//default attack value
        this.def = 5;//defense shield
        this.memory = new Map();//bool grid of the player's memory
        this.equipment = new Map();//mapping items to their slots for the player
        this.handItems = [];//items held in hands since there can be two one-handed items
        this.traits = [];//chosen traits from element
        this.element = null;//element
    }

    applyTrait(traitKey)//applying trait to the player
    {
        const trait = traits[traitKey];//look up the trait info
        if (!trait) return;//failsafe

        this.traits.push(traitKey);//remember which trait was chosen
        this.element = trait.element;//element that comes from the trait

        //apply the stat bonuses
        this.maxHp = this.maxHp + trait.maxHpBonus;
        this.hp = this.hp + trait.maxHpBonus;
        this.atk = this.atk + trait.atkBonus;
        this.def = this.def + trait.defBonus;

    }

    cantWeildItem(item)//some traits forbid items
    {
        const itemClassName = item.constructor.name;//takes the name of the passed in item

        for (const traitKey of this.traits)//check every trait the player has
        {
            const trait = traits[traitKey];
            if (trait && trait.cantWeild.includes(itemClassName)) 
            {
                return true;//forbidden
            }
        }
        return false;//no trait forbids it
    }

    damageMultiplierAgainst(target) {
        const targetElement = target.element;
        if (this.element === null || this.element === undefined || targetElement === null || targetElement === undefined) 
        {
            return 1;
        }
        return effectiveness[this.element][targetElement] || 1;//default 1 if something's missing
    }
    get symbol() {
        return "@";
    }
    get renderPriority() {
        return 999999;//basically always displayed
    }
    get parent() {
        return super.parent;
    }
    set parent(newparent) {
        if (newparent !== null && !(newparent instanceof Level)) {
            throw new Error("the parent of a player must be a level.");
        }
        super.parent = newparent;
    }
}

class UpStairway extends Entity {
    constructor() 
    {
        super();
        this.correspondingStaircase = null;//starts unlinked but will be used to create the relation between staircases
    }
    get symbol() {
        return "<";//stair
    }
    get renderPriority() {
        return 10;//less than player
    }
    get parent() {
        return super.parent;
    }
    set parent(newparent) {
        if (newparent !== null && !(newparent instanceof Level)) 
        {
            throw new Error("must be a level");
        }
        super.parent = newparent;
    }
}

class DownStairway extends Entity//to go to the new levels
{
    constructor()
    {
        super();
        this.correspondingStaircase = null;
    }
    get symbol() {
        return ">";  // the down staircase symbol
    }
    get renderPriority() {
        return 10;  // same priority as up stairway, below player (999999)
    }
    get parent() {
        return super.parent;
    }
    set parent(newparent) {
        if (newparent !== null && !(newparent instanceof Level)) {
            throw new Error("must be a level");
        }
        super.parent = newparent;
    }
}

class Item extends Entity{
    get isPortable() {
        return true;
    }

    //what slot the thing takes
    get slot() {
        return null;
    }

    //for weapons only (1 by default)
    get hands() {
        return 1;
    }

    //how much attack this item gives while equipped (0 by default)
    get atkBonus() {
        return 0;
    }

    //how much defense this item gives while equipped (0 by default)
    get defBonus() {
        return 0;
    }

    get parent() {
        return super.parent;
    }
    
    set parent(newparent) {
        if (newparent !== null && !(newparent instanceof Level) && !(newparent instanceof Player) && !(newparent instanceof badGuy))//evaluates to false overall if the parent isn't a level, badguy, or player
        {
            throw new Error("Parent of an item must be a level, a player, or a monster.");
        }
        super.parent = newparent;
    }
}

class Crown extends Item {
    get symbol() {
        return '♕';//crown now and i'm using the chess piece
    }
    get renderPriority() {
        return 20;//less than player but more than stairs
    }
    get slot() {
        return "head";//worn on head
    }
    get defBonus() {
        return 1;//only protects a bit
    }
}

class Sword extends Item {
    get symbol() {
        return '⚔';//it might render as an emoji in IDE but in firefox it's a regular unicode character which doesn't push the row to the right (since emojis are too wide)
    }
    get renderPriority() {
        return 20;//less than player but more than stairs
    }
    get slot() {
        return "hand";
    }
    get hands() {
        return 1;//not-claymore sword is one-handed
    }
    get atkBonus() {
        return 3;//wielding a sword makes you hit harder
    }
}

class Coffee extends Item {
    get symbol() {
        return '☕︎';
    }
    get renderPriority() {
        return 20;
    }
}

class Potion extends Item {
    get symbol() {
        return '⚗';
    }
    get renderPriority() {
        return 20;
    }
}

class Cloak extends Item {
    get symbol() {
        return '𓀠';
    }
    get renderPriority() {
        return 20;
    }
    get slot() {
        return "body";//worn
    }
    get defBonus() {
        return 1;
    }
}

class Lyre extends Item {
    get symbol() {
        return '♪';
    }
    get renderPriority() {
        return 20;
    }
    //some thigns can't be equipped
}

class Helmet extends Item {
    get symbol() {
        return '⛑︎';
    }
    get renderPriority() {
        return 20;
    }
    get slot() {
        return "head";
    }
    get defBonus() {
        return 1;
    }
}

class Armour extends Item {
    get symbol() {
        return '𐂫';
    }
    get renderPriority() {
        return 20;
    }
    get slot() {
        return "body";
    }
    get defBonus() {
        return 3;
    }
}

class Boots extends Item {
    get symbol() {
        return '𓃀';//egyptian foot thing
    }
    get renderPriority() {
        return 20;
    }
    get slot() {
        return "feet";
    }
    get defBonus() {
        return 1;
    }
}

class Ring extends Item {
    get symbol() {
        return '◎';
    }
    get renderPriority() {
        return 20;
    }
    get slot() {
        return "finger";//rings go on fingers
    }
    get defBonus() {
        return 1;
    }
}

class Shield extends Item {
    get symbol() {
        return '▣';
    }
    get renderPriority() {
        return 20;
    }
    get slot() {
        return "hand";
    }
    get hands() {
        return 1;//takes one hand like a regular sword
    }
    get defBonus() {
        return 3;//a shield blocks hits
    }
}

class Claymore extends Item {
    get symbol() {
        return '𐃉';//google says that's a sword
    }
    get renderPriority() {
        return 20;
    }
    get slot() {
        return "hand";
    }
    get hands() {
        return 2;//shield can't also be used
    }
    get atkBonus() {
        return 5;//a claymore hits harder than a regular sword
    }
}

class badGuy extends Entity {
    constructor() {
        super();
        if (new.target === badGuy) {
            throw new Error("you can't make a bad guy class on it's own since it's abstract");
        }
        this.x = 0;
        this.y = 0;
        this.maxHp = 10;//
        this.hp = 10;   //
        this.atk = 5;   // a lot less than player for default enemy. defined for each individual enemy
        this.def = 1;   //
        this.goal = "ignore";//default fallback goal is ignore
        this.equipment = new Map();
        this.handItems = [];
        this.element = null;//yeah i'm going to hard code their elements
    }
    
    get parent() {
        return super.parent;
    }
    
    set parent(newparent) {
        if (newparent !== null && !(newparent instanceof Level)) {
            throw new Error("parent of a bad guy must be a level");
        }
        super.parent = newparent;
    }

    canPickUp(item) {
        return true;
    }

    //whether this monster can wear/wield the given item (only some monsters can)
    canWear(item) {
        return false;//monsters can't wear anything by default and is overridden on a per-bad guy basis
    }
}
class hilichurl extends badGuy {
    constructor() {
        super();
        this.maxHp = 30;
        this.hp = 30;
        this.atk = 10; //more than a regular badGuy
        this.def = 2;
        this.element = "pyro";
    }

    get symbol() {
        return "H"; // Representation on the grid
    }
    
    get renderPriority() {
        return 100; //render below player but above stairs
    }

    canWear(item) {
        return item.slot !== null;//can wear armor and wield weapons
    }
}


class slime extends badGuy {
    constructor() {
        super();
        this.goal = "attack";//hostile by defaulty
        this.maxHp = 50;
        this.hp = 50;
        this.atk = 15; //stronger than a hilichurl by a bit
        this.def = 3;
        this.element = "hydro";
    }

    get symbol() {
        return "S";
    }

    get renderPriority() {
        return 100;
    }
}


class treasureHoarder extends badGuy {
    constructor() {
        super();
        this.goal = "ignore";//harmless by default (until the player gets close)
        this.maxHp = 20;
        this.hp = 20;
        this.atk = 8;
        this.def = 1;
        this.element = "geo";
    }

    get symbol() {
        return "T";
    }

    get renderPriority() {
        return 100;
    }

    canWear(item) {
        return item.slot !== null;//can wear armor and wield weapons
    }
}


class dog extends badGuy {
    constructor() {
        super();
        this.goal = "follow";//follows the player around
        this.maxHp = 15;
        this.hp = 15;
        this.atk = 5;
        this.def = 1;
        this.element = "anemo";
    }

    get symbol() {
        return "D";
    }

    get renderPriority() {
        return 100; // Render below player (999999) but above stairs (10)
    }
}


class rectroom {
    constructor(left, top, width, height) {
        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;
    }

    get right() {
        return this.left + this.width;
    }

    get bottom() {
        return this.top + this.height; //rectangle.right and rectangle.bottom
    }

    // says true if the other rectangle is entirely inside this one.
    contains(other) {
        return other.left >= this.left &&
            other.right <= this.right &&
            other.top >= this.top &&
            other.bottom <= this.bottom;
    }

    // says true if the other rectangle overlaps with this one at all.
    overlaps(other) {
        return !(
            other.left >= this.right ||
            other.right <= this.left ||
            other.top >= this.bottom ||
            other.bottom <= this.top
        );
    }
}



//nested functions removed and some take in the gamegrid too now (some don't because they just check coordinnates and don't need access to the board itself)
function canconnectvertical(roomA, roomB) {
    const maxLeft = Math.max(roomA.left + 1, roomB.left + 1);
    const minRight = Math.min(roomA.right - 1, roomB.right - 1);
    return maxLeft < minRight;
}

function canconnecthorizontal(roomA, roomB) {
    const maxTop = Math.max(roomA.top + 1, roomB.top + 1);
    const minBottom = Math.min(roomA.bottom - 1, roomB.bottom - 1);
    return maxTop < minBottom;
}

function tunnelcollides(gamegrid, x1, y1, x2, y2) {
    if (x1 === x2) {
        // vertical tunnel x is fixed, y changes
        const startY = Math.min(y1, y2) + 1;
        const endY = Math.max(y1, y2) - 1;
        for (let y = startY; y <= endY; y++) {
            if (gamegrid.get(x1, y) !== "█") {
                return true;
            }
        }
    }

    else {
        const startX = Math.min(x1, x2) + 1; //the +1 here and the -1 below make it only scan tiles between the rooms, not the room borders themselves
        const endX = Math.max(x1, x2) - 1;
        for (let x = startX; x <= endX; x++) {
            if (gamegrid.get(x, y1) !== "█") {
                return true; // hit not empty space
            }
        }
    }
    return false;
}

function digverticaltunnel(gamegrid, roomA, roomB) {
    const maxLeft = Math.max(roomA.left + 1, roomB.left + 1);
    const minRight = Math.min(roomA.right - 1, roomB.right - 1);
    if (maxLeft >= minRight) return false;
    const tunnelX = Math.floor((maxLeft + minRight) / 2);

    const toproom = roomA.top < roomB.top ? roomA : roomB;
    const bottomroom = roomA.top < roomB.top ? roomB : roomA;

    const startY = toproom.bottom - 1;
    const endY = bottomroom.top;

    if (tunnelcollides(gamegrid, tunnelX, startY, tunnelX, endY)) { //quickly check if anytyhing in the way
        return false;
    }

    for (let y = startY; y <= endY; y++) {
        gamegrid.set(tunnelX, y, " "); //this makes the tunnel be blank space, INCLUDING the room border themselves (like a door)
    }
    return true;
}

function dighorizontaltunnel(gamegrid, roomA, roomB) {
    const maxTop = Math.max(roomA.top + 1, roomB.top + 1);
    const minBottom = Math.min(roomA.bottom - 1, roomB.bottom - 1);
    if (maxTop >= minBottom) return false;
    const tunnelY = Math.floor((maxTop + minBottom) / 2); //so there can only be one tunnel between rooms (same thuing for vertical)

    // find out which room is to the left and which is to the right
    const leftRoom = roomA.left < roomB.left ? roomA : roomB;
    const rightRoom = roomA.left < roomB.left ? roomB : roomA;

    const startX = leftRoom.right - 1;
    const endX = rightRoom.left;

    if (tunnelcollides(gamegrid, startX, tunnelY, endX, tunnelY)) {
        return false;
    }

    for (let x = startX; x <= endX; x++) {
        gamegrid.set(x, tunnelY, " ");
    }
    return true;
}

function digbenttunnel(gamegrid, roomA, roomB) {
    const cxA = Math.floor(roomA.left + roomA.width / 2);
    const cyA = Math.floor(roomA.top + roomA.height / 2);
    const cxB = Math.floor(roomB.left + roomB.width / 2);
    const cyB = Math.floor(roomB.top + roomB.height / 2);

    let hStart1;
    if (cxB > cxA) //check whether to start on right wall or left wall of roomA
    {
        hStart1 = roomA.right - 1; // right wall
    }
    else {
        hStart1 = roomA.left; // left wall
    }

    const hEnd1 = cxB;

    const vStart1 = cyA;
    let vEnd1;
    if (cyB > cyA) // check whether to end on top wall or bottom wall of roomB
    {
        vEnd1 = roomB.top; // top wall
    }
    else {
        vEnd1 = roomB.bottom - 1; // bottom wall
    }

    const hSeg1Collides = tunnelcollides(gamegrid, hStart1, cyA, hEnd1, cyA);  //checks if the horizontal part of the tunnel collides with anything
    const vSeg1Collides = tunnelcollides(gamegrid, cxB, vStart1, cxB, vEnd1);  //checks if the vertical part of the tunnel collides with anything
    const corner1Solid = gamegrid.get(cxB, cyA) === "█"; //checks if the corner is empty

    if (!hSeg1Collides && !vSeg1Collides && corner1Solid) // if those above three things are true then dig the tunnel
    {

        const startX = Math.min(cxA, cxB); // start at the leftmost x coordinate of either room a or b
        const endX = Math.max(cxA, cxB); // end at the rightmost x coordinate of either room a or b

        for (let x = startX; x <= endX; x++) // loop through the x coordinates
        {
            gamegrid.set(x, cyA, " ");
        }

        const startY = Math.min(cyA, cyB); //same thing but up
        const endY = Math.max(cyA, cyB);

        for (let y = startY; y <= endY; y++) {
            gamegrid.set(cxB, y, " ");
        }

        return true; //stop if this worked
    }
    // all of this is the exact same stuff but vertical first
    let vStart2;
    if (cyB > cyA) // check whether to start on bottom wall or top wall of roomA
    {
        vStart2 = roomA.bottom - 1; // bottom wall
    }
    else {
        vStart2 = roomA.top; // top wall
    }
    const vEnd2 = cyB;
    const hStart2 = cxA;
    let hEnd2;
    if (cxB > cxA) // check whether to end on left wall or right wall of roomB
    {
        hEnd2 = roomB.left; // left wall
    }
    else {
        hEnd2 = roomB.right - 1; // right wall
    }

    const vSeg2Collides = tunnelcollides(gamegrid, cxA, vStart2, cxA, vEnd2);
    const hSeg2Collides = tunnelcollides(gamegrid, hStart2, cyB, hEnd2, cyB);
    const corner2Solid = gamegrid.get(cxA, cyB) === "█";

    if (!vSeg2Collides && !hSeg2Collides && corner2Solid) {
        const startY = Math.min(cyA, cyB);
        const endY = Math.max(cyA, cyB);

        for (let y = startY; y <= endY; y++) {
            gamegrid.set(cxA, y, " ");
        }

        const startX = Math.min(cxA, cxB);
        const endX = Math.max(cxA, cxB);

        for (let x = startX; x <= endX; x++) {
            gamegrid.set(x, cyB, " ");
        }

        return true;//stop if this worked
    }

    return false;// if those above all failed, then it failed and leaves
}


function addPillars(gamegrid) //function that adds the "O" pillars themselves to the grid
//by the way i should mention in case it's not obvious; these comments are for ME mostly (becuase i'll forget what something does after 5 minutes so having it just say is helpful) 
{
    const candidates = [];//list of allowed squares for pillars
    for (let y = 0; y < gamegrid.height; y++) {   // for all tiles on the map
        for (let x = 0; x < gamegrid.width; x++) {//
            if (gamegrid.get(x, y) !== " ") continue;   //if the tile is open floor than don't skip it
            let clear = true;//becomes false if the tile isn't a possible candidate
            for (let dy = -1; dy <= 1 && clear; dy++) {//go through the y tiles one above, the same as, and one below the target square
                for (let dx = -1; dx <= 1; dx++) {//for each y level that we're checking, check each individual tile on the x axis
                    if (dx === 0 && dy === 0) continue;  // the cell we're checking itself
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || nx >= gamegrid.width || ny < 0 || ny >= gamegrid.height) continue;//if it's off the map
                    if (gamegrid.get(nx, ny) !== " ") 
                    {
                        clear = false; 
                        break; 
                    }
                }
            }
            if (clear) candidates.push({ x, y });// add the tile as an allowed candidate to the candidates array
        }
    }

    for (let i = candidates.length - 1; i > 0; i--) 
    {
        const j = uniformrandom(i);
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }//fisher yates shuffle

    const howMany = boundedrandom(2, 4);//placing the first 2-4 pillars from the randomly sorted list of candidates
    let placed = 0;
    for (let i = 0; i < candidates.length && placed < howMany; i++) 
    {
        const p = candidates[i];
        gamegrid.set(p.x, p.y, "O");//directly place the pillar onto the map
        placed++;
        for (let j = candidates.length - 1; j > i; j--) {//go through every remaining candidate
            const q = candidates[j];
            if (Math.abs(q.x - p.x) <= 1 && Math.abs(q.y - p.y) <= 1)//check if too close to the new pillar
            {
                candidates.splice(j, 1);   //too close to the new pillar
            }
        }
    }
}





function trycreaterooms() {
    //code for creating random rooms
    let existingrooms = [];
    const howmanyroomstomake = boundedrandom(4, 10);
    const gridWidth = 50;
    const gridHeight = 50;
    let roomsleft = howmanyroomstomake;

    while (roomsleft > 0) {
        let width = boundedrandom(4, 8);
        let height = boundedrandom(4, 8);
        let left = uniformrandom(gridWidth - width); // so it doesn't extend out
        let top = uniformrandom(gridHeight - height); // so it doesn't extend out
        let newroom = new rectroom(left, top, width, height);

        let overlaps = false;
        let iscontained = false;
        for (let i = 0; i < existingrooms.length; i++) {
            if (newroom.overlaps(existingrooms[i])) {
                overlaps = true;
            }
            if (existingrooms[i].contains(newroom)) {
                iscontained = true;
            }
            if (overlaps || iscontained) {
                break;
            }
        }

        if (!overlaps && !iscontained) {
            existingrooms.push(newroom);
            roomsleft -= 1;
        }
    }
    console.log(existingrooms);

    //create a grid and fill it with something that i keep changing and then set it to a pre element 
    const gamegrid = new Grid(50, 50, "█");
    gamegridtext.textContent = gamegrid.toString();

    for (let room of existingrooms) {
        gamegrid.addroom(room);
    }
    gamegridtext.textContent = gamegrid.toString();

    let setofsets = [];
    for (let i = 0; i < existingrooms.length; i++) {
        setofsets.push(new Set([i]));
    }

    const tunnelattempts = existingrooms.length * 20; // increased so we have enough tries to connect everything
    for (let i = 0; i < tunnelattempts; i++) {

        let indexA = uniformrandom(existingrooms.length - 1);
        let indexB = uniformrandom(existingrooms.length - 1);

        while (indexB === indexA) {
            //force it to not be the same room
            indexB = uniformrandom(existingrooms.length - 1);
        }

        const roomA = existingrooms[indexA];
        const roomB = existingrooms[indexB];

        let success = false;
        // check vertical first, then horizontal, then bent
        if (canconnectvertical(roomA, roomB)) {
            success = digverticaltunnel(gamegrid, roomA, roomB);
        }

        else if (canconnecthorizontal(roomA, roomB)) {
            success = dighorizontaltunnel(gamegrid, roomA, roomB);
        }

        else {
            success = digbenttunnel(gamegrid, roomA, roomB);
        }

        if (success) {
            let setA = setofsets.find(s => s.has(indexA)); // tgets the current set within the set that has the number that room A is in
            let setB = setofsets.find(s => s.has(indexB)); // same but b
            if (setA && setB && setA !== setB) { // if success and they are currently not in the same set......
                setB.forEach(val => setA.add(val)); //add (not move but add) the rooms from B to A
                setofsets = setofsets.filter(s => s !== setB); //remove B from setofsets so it's not counted twice and will now get merged into A on the next loop
                }
            }

        // if there's only 1 set left then all rooms are connected
        if (setofsets.length === 1) {
            break;
        }
    }

    if (setofsets.length === 1) {
        addPillars(gamegrid);//add the pillars
        gamegridtext.textContent = gamegrid.toString();
        return { rooms: existingrooms, grid: gamegrid }; // returning the data of the rooms and grid so it can be used in the rest of the game other than this function that just makes the initial grid
    }
}

function createtherooms() {
    for (let attempt = 0; attempt < 100; attempt++) {
        let success = trycreaterooms();
        if (success) return success;//continues to return the data given by `return { rooms: existingrooms, grid: gamegrid }; `
    } // end of the 100 tries loop
    throw new Error("didn't work");
} // end createtherooms

class Action {
    constructor(doer) {
        this.doer = doer;
    }
    execute() {//no more doAction function at all; there's an execute in each action class that has the thing to move passed into it
        throw new Error("you actually have to execute a single action.");
    }
}

class moveAction extends Action {
    constructor(doer, dx, dy) {//d for delta
        super(doer);
        this.dx = dx; // -1, 0, or 1 for movement on both axis
        this.dy = dy;
    }
    execute() {
        const level = this.doer.parent;
        if (!(level instanceof Level)) return;//failsafe

        const newX = this.doer.x + this.dx;
        const newY = this.doer.y + this.dy;

        //callback function to check if there is a monster in the target cell
        const targetMonster = level.children.find(child =>
            child instanceof badGuy && child.x === newX && child.y === newY
        );

        if (targetMonster && this.doer === theCurrentPlayer) {//if that callback function returned true then do this instead then return
            if (targetMonster.goal === "attack") {//hostile monsters get attacked on contact as before without asking the player
                new attackAction(this.doer, targetMonster).execute();//which is an attack action
            } 
            else 
            {//ignore or following monsters ask the player first instead of attacking automatically
                pendingAttackTarget = targetMonster;//sets which monster for if the user responds Y to the prompt and also makes the response code on key press run
                let mood;
                if (targetMonster.goal === "follow") 
                {
                    mood = "following";
                } 
                else 
                {
                    mood = "ignoring";
                }
                logMessage(targetMonster.constructor.name + " is " + mood + " you. Do you want to attack? (Y/N)");
            }
            return;
        }

        if (isWalkable(level, newX, newY)) {//otherwise then move if no attack
            this.doer.x = newX;
            this.doer.y = newY;
            drawLevel(level, theCurrentDisplay);//draw the grid with updated position
        }
    }
}

class attackAction extends Action {
    constructor(doer, target) {//defining the attacker and attackee(?)
        super(doer);
        this.target = target;
    }
    execute() {
        const variance = uniformrandom(4) - 2; // -2 to 2. this adds randomness to the attacks

        let elementMultiplier = 1;//1 by default if no elements
        if (this.doer.element && this.target.element)//only do the matchup thing if both sides have an element (both should as of this comment unless i messed it up)
        {
            const effectivenessRow = effectiveness[this.doer.element];//the attacker's entire row of the table
            if (effectivenessRow && effectivenessRow[this.target.element] !== undefined)//failsafe in case a matchup was never defined
            {
                elementMultiplier = effectivenessRow[this.target.element];//the speicific multiplier from the attacker's row
            }
        }

        //damage = attack + randomness - defense, then multiplied by the element matchup (rounded, min 1)
        const bDamage = (this.doer.atk + variance) - this.target.def;//base damage
        const damage = Math.max(1, Math.round(bDamage * elementMultiplier));//the original negative/zero failsafe
        this.target.hp -= damage;

        const attackerName = this.doer.name || this.doer.constructor.name;//get the name of the attacker for display

        if (this.target === theCurrentPlayer) {//a monster is attacking the player so tell the player without the generic prompt
            logMessage("A " + attackerName + " attacks you for " + damage + " damage! (Your HP: " + Math.max(0, this.target.hp) + "/" + this.target.maxHp + ")");

            if (this.target.hp <= 0) {//the player died
                logMessage("You have been defeated!");
                theCurrentPlayer = null;
                theCurrentLevel = null;
                updateHealthDisplayer();
                updateTraitDisplayer();//clear the trait box since there is no player
            }
            return;//leave early
        }

        const targetName = this.target.constructor.name;
        logMessage(attackerName + " attacks " + targetName + " for " + damage + " damage! (" + targetName + " HP: " + Math.max(0, this.target.hp) + "/" + this.target.maxHp + ")");

        if (this.target.hp <= 0) {//if the attackee's health is less than or equal to zero (dead)
            logMessage(targetName + " has been defeated!");
            
            //drop everything
            const level = this.target.parent;//the level to place the items on
            const items = this.target.children;//array of the items owned by the dead monster
            for (const item of items) //for each item...
            {
                item.x = this.target.x; //set the coords of the item to the coords of the dead monster
                item.y = this.target.y; 
                item.parent = level; //set the parent of the item to the level so it's displayed on the level floor
            }
            
            this.target.equipment.clear();//clear the weilded list
            this.target.handItems = [];//clear the held list
            
            //remove target monster('s association with any parent)
            this.target.parent = null;//the monster doesn't actually stop existing in the monsters array, so we can just dissasociate this monster from any kind of relationship
            
            // Redraw display
            drawLevel(level, theCurrentDisplay);//redraw so the monster disappears
        }
    }
}

class pickupAction extends Action {
    constructor(doer) {
        super(doer);
    }
    execute() {
        const level = this.doer.parent;
        if (level instanceof Level) //make sure valid level object
        {
            const itemsToPickUp = level.children.filter(child =>//list of items that can be picked up
                child !== this.doer &&//can;t be player
                child.x === this.doer.x &&//must be same x and y
                child.y === this.doer.y &&//
                child.isPortable//has to be able to be picked up
            );


            for (const item of itemsToPickUp) 
            {
                item.parent = this.doer;//become under the player instead of the level
            }

            if (itemsToPickUp.length > 0) //if anything was picked up
            {
                drawLevel(level, theCurrentDisplay);
                const itemNames = itemsToPickUp.map(item => item.constructor.name).join(", ");
                logMessage("you picked up: " + itemNames);
                if (this.doer === theCurrentPlayer) {
                    new listInventoryAction(this.doer).execute();//automatically list the inventory when picking up an item
                }
            }
        }
    }
}

class climbStairsAction extends Action {
    constructor(doer) {
        super(doer);
    }
    execute()
    {
        const level = this.doer.parent;
        if (!(level instanceof Level)) return;//failsafe

        const stairway = level.children.find(child =>//look for stairway at the same position
            child instanceof UpStairway &&
            child.x === this.doer.x &&
            child.y === this.doer.y
        );
        if (!stairway) return;//not on an up staircase

        if (level.depth === 1) {//on the top level, so this is the exit
            const hasCrown = this.doer.children.some(child => child instanceof Crown);//check if the crown is a child of the player
            if (hasCrown) 
            {
                logMessage("you escaped with the Crown! You Win!");
            } 
            else 
            {
                logMessage("you escaped without the Crown! You Lose!");
            }

            if (this.doer === theCurrentPlayer) {
                theCurrentPlayer = null;
                theCurrentLevel = null;
                updateHealthDisplayer();
                updateTraitDisplayer();//clear the trait box since there is no player
            }
            return;
        }

        //deeper level if we didn't return earlier
        const targetStair = stairway.correspondingStaircase;
        const targetLevel = targetStair.parent;
        this.doer.x = targetStair.x;
        this.doer.y = targetStair.y;
        this.doer.parent = targetLevel;//player now on the level above

        //redraw
        theCurrentLevel = targetLevel;//monstersTurn() and drawLevel() act on the new level
        theCurrentDisplay = new Grid(targetLevel.map.width, targetLevel.map.height, " ");//blank display for the new level
        drawLevel(targetLevel, theCurrentDisplay);
        updateFloorIndicator();//show the new floor
        logMessage("you climb the staircase.");//tell the player
    }
}

class goDownAction extends Action {//the action taken when the player uses the ">" stairway to descend
    constructor(doer) {
        super(doer);
    }
    execute() {
        const level = this.doer.parent;
        if (!(level instanceof Level)) return;//failsafe

        //locate
        const stairway = level.children.find(child =>
            child instanceof DownStairway &&
            child.x === this.doer.x &&
            child.y === this.doer.y
        );
        if (!stairway) return;//tried to go down while not on a go down staircase

        //if no existing next level yet
        if (!stairway.correspondingStaircase) 
        {
            //generate a brand new level using the same room generator
            const roomdata = createtherooms();
            const nextLevel = new Level(roomdata.grid);
            nextLevel.parent = level.parent;//same parent as main level
            nextLevel.depth = level.depth + 1;//one deeper than the current level (the current level the player is on)

            //whether this is the bottom level (no down staircase goes deeper)
            const isBottom = nextLevel.depth >= dungeonDepth;

            //place an UpStairway on the new level
            const upStairway = new UpStairway();
            for (let attempt = 0; attempt < 20; attempt++)
            {
                const room = roomdata.rooms[uniformrandom(roomdata.rooms.length - 1)];//random room
                const sx = boundedrandom(room.left + 1, room.right - 2);//random x
                const sy = boundedrandom(room.top + 1, room.bottom - 2);//random y

                const occupied = nextLevel.children.some(child => child.x === sx && child.y === sy) ||//any entity already there
                    nextLevel.map.get(sx, sy) !== " ";//true if there's a not clear space

                if (!occupied)//free spot
                {
                    upStairway.x = sx;
                    upStairway.y = sy;
                    upStairway.parent = nextLevel;
                    break;
                }
            }

            //place a DownStairway on the new level (unless it's the bottom so the player can't go beyond the max depth)
            let downStairway = null;
            if (!isBottom)
            {
                downStairway = new DownStairway();
                for (let attempt = 0; attempt < 20; attempt++)
                {
                    const room = roomdata.rooms[uniformrandom(roomdata.rooms.length - 1)];//random room
                    const sx = boundedrandom(room.left + 1, room.right - 2);//random x
                    const sy = boundedrandom(room.top + 1, room.bottom - 2);//random y

                    const occupied = nextLevel.children.some(child => child.x === sx && child.y === sy) ||//any entity already there
                        nextLevel.map.get(sx, sy) !== " ";//true if there's a not clear space

                    if (!occupied)//free spot
                    {
                        downStairway.x = sx;
                        downStairway.y = sy;
                        downStairway.parent = nextLevel;
                        break;
                    }
                }
            }

            //link the two staircases
            stairway.correspondingStaircase = upStairway;
            upStairway.correspondingStaircase = stairway;

            //spawning random items on the new level (but not on any staircase)
            const itemClasses = [Coffee, Sword, Lyre, Potion, Sword, Helmet, Armour, Boots, Shield, Claymore, Ring, Cloak];//list of all the items
            const numItems = boundedrandom(5, 10);
            for (let i = 0; i < numItems; i++) {//for the randomly chosen amount of items
                for (let attempt = 0; attempt < 20; attempt++) {//20 attempts
                    const itemRoom = roomdata.rooms[uniformrandom(roomdata.rooms.length - 1)];//random room
                    const ix = boundedrandom(itemRoom.left + 1, itemRoom.right - 2);//random x in room
                    const iy = boundedrandom(itemRoom.top + 1, itemRoom.bottom - 2);//random y in room

                    const occupied = nextLevel.children.some(child => child.x === ix && child.y === iy) ||//any entity already there (including stairs)
                        nextLevel.map.get(ix, iy) !== " ";//true if there's a not clear space

                    if (!occupied)//if not occupied 
                    {
                        const itemClass = itemClasses[uniformrandom(itemClasses.length - 1)];//random item with the name itemClass
                        const item = new itemClass();//create the item
                        item.x = ix;//set location
                        item.y = iy;
                        item.parent = nextLevel;
                        break;
                    }
                }
            }

            //spawn monsters on the new level (but not on any staircase)
            const monsterClasses = [hilichurl, hilichurl, hilichurl, slime, treasureHoarder, dog];//hilichurls are most common
            const numMonsters = boundedrandom(3, 7);
            for (let i = 0; i < numMonsters; i++) {//loop through number of monsters to add
                for (let attempt = 0; attempt < 20; attempt++) {//20 attempts before giving up for each monster
                    const monsterRoom = roomdata.rooms[uniformrandom(roomdata.rooms.length - 1)];//getting a random room to place the monster in
                    const hx = boundedrandom(monsterRoom.left + 1, monsterRoom.right - 2);//random x in room
                    const hy = boundedrandom(monsterRoom.top + 1, monsterRoom.bottom - 2);//random y in room

                    const occupied = nextLevel.children.some(child => child.x === hx && child.y === hy) ||//any entity already there
                        nextLevel.map.get(hx, hy) !== " ";//rejecting non-floor in general

                    if (!occupied) {//if the position is not occupied
                        const monsterClass = monsterClasses[uniformrandom(monsterClasses.length - 1)];//random monster type
                        const theMonster = new monsterClass();//create the random monster
                        theMonster.x = hx;
                        theMonster.y = hy;
                        theMonster.parent = nextLevel;

                        // 30% chance for this monster to get a random item
                        if (uniformrandom(9) < 3) {
                            const itemClass = itemClasses[uniformrandom(itemClasses.length - 1)];
                            const carriedItem = new itemClass();
                            carriedItem.parent = theMonster;

                            //automatically equip if possible
                            if (theMonster.canWear(carriedItem)) 
                            {
                                new putOnAction(theMonster, carriedItem).execute();
                            }
                        }
                        break;
                    }
                }
            }

            //place the crown on the deepest level only (crown code is now here)
            if (isBottom)
            {
                for (let attempt = 0; attempt < 20; attempt++)
                {
                    const room = roomdata.rooms[uniformrandom(roomdata.rooms.length - 1)];//random room
                    const cx = boundedrandom(room.left + 1, room.right - 2);//random x
                    const cy = boundedrandom(room.top + 1, room.bottom - 2);//random y

                    const occupied = nextLevel.children.some(child => child.x === cx && child.y === cy) ||//any entity already there
                        nextLevel.map.get(cx, cy) !== " ";//true if there's a not clear space

                    if (!occupied)//free spot
                    {
                        const crown = new Crown();
                        crown.x = cx;
                        crown.y = cy;
                        crown.parent = nextLevel;
                        break;
                    }
                }
            }
        }

        //teleport the player to the corresponding staircase
        const targetStair = stairway.correspondingStaircase;
        const targetLevel = targetStair.parent;
        this.doer.x = targetStair.x;
        this.doer.y = targetStair.y;
        this.doer.parent = targetLevel;//player now on different level

        //redraw
        theCurrentLevel = targetLevel;//monstersTurn() and drawLevel() act on the new level
        theCurrentDisplay = new Grid(targetLevel.map.width, targetLevel.map.height, " ");//blank display for the new level
        drawLevel(targetLevel, theCurrentDisplay);
        updateFloorIndicator();//show the new floor
        logMessage("you descend the staircase.");//tell the player
    }
}

class listInventoryAction extends Action {
    execute() {
        const div = document.getElementById("inventory-list");//the new html div for the list
        if (!div) return;//failsafe
        const children = this.doer.children;//gets the items that are children of the player (this.doer)
        if (children.length === 0) //if no items
        {
            div.innerText = "You are empty-handed.";
        } 
        else //if has items
        {
            div.innerText = children.map((item, idx) => //.map loops through all the elements in the array "children" which is going to be passed in as the array of the children of the player
                (idx + 1) + ". " + item.constructor.name.toLowerCase()// "(idx + 1) + ". " + " lists them as like "1. 2. 3."
            ).join("\n");//makes a new line for each item
        }
    }
}

class dropAction extends Action {
    constructor(doer, item)//getting the entity dropping the item and which item to have dropped respectively
    {
        super(doer);
        this.item = item;
    }
    execute() {
        const level = this.doer.parent;
        if (level instanceof Level)//failsafe
        {
            this.item.x = this.doer.x;//
            this.item.y = this.doer.y;//item is dropped where the dropper is standing
            this.item.parent = level;//item now has the parent of level instead of the entity that dropped it
            drawLevel(level, theCurrentDisplay);//redraw screen since it now needs to be on the floor
            
            logMessage("you dropped: " + this.item.constructor.name.toLowerCase());
            if (this.doer === theCurrentPlayer) {
                new listInventoryAction(this.doer).execute();//show inventory when dropping an item
            }
        }
    }
}

class putOnAction extends Action {
    constructor(doer, item) {
        super(doer);
        this.item = item;
    }
    execute() {
        const slot = this.item.slot;//which slot this item goes into
        const isPlayer = this.doer === theCurrentPlayer;//if the player is equipping the thing
        
        //correct pronouns/conjugation
        let doerName;
        if (isPlayer) 
        {
            doerName = "you";
        } 
        else 
        {
            doerName = "the " + this.doer.constructor.name.toLowerCase();
        }
        
        const itemName = this.item.constructor.name.toLowerCase();
        if (this.doer.cantWeildItem && this.doer.cantWeildItem(this.item))//first part is mostly a failsafe
        {
            logMessage("one of your traits makes it so you can't use the " + itemName);//trait restrictions
            return;
        }

        if (slot === "hand") 
        {
            const handsUsed = this.doer.handItems.reduce((total, item) => total + item.hands, 0);//callback function that goes through the list of items in the user's hands and adds the objects hand used values to this variable
            
            const alreadyHeld = this.doer.handItems.find(item => item === this.item);//true if already holding this item
            if (alreadyHeld) 
            {
                let areIs;
                if (isPlayer) 
                {
                    areIs = "are";
                } 
                else 
                {
                    areIs = "is";
                }
                logMessage(doerName + " " + areIs + " already holding the " + itemName);
                return;
            }

            // can't exceed 2 hands total
            if (handsUsed + this.item.hands > 2) 
            {
                let dontDoesnt;
                if (isPlayer) 
                {
                    dontDoesnt = "don't";
                } 
                else 
                {
                    dontDoesnt = "doesn't";
                }
                logMessage(doerName + " " + dontDoesnt + " have enough hands to hold a " + itemName);
                return;
            }

            // put it in hand
            this.doer.handItems.push(this.item);
            addItemStats(this.doer, this.item);//wielding the item boosts the doer's stats
            logMessage(doerName + " started holding the " + itemName);
        }
        else 
        {
            if (!slot)//can't be equipped at all
            {
                logMessage(doerName + " can't equip " + itemName);
                return;
            }

            //auto swap
            const currentItem = this.doer.equipment.get(slot);
            if (currentItem) 
            {
                subtractItemStats(this.doer, currentItem);//stop getting the old item's bonuses

                let removeRemoves;
                if (isPlayer) 
                {
                    removeRemoves = "remove";
                } 
                else 
                {
                    removeRemoves = "removes";
                }
                logMessage(doerName + " " + removeRemoves + " the " + currentItem.constructor.name.toLowerCase() + ".");
                this.doer.equipment.delete(slot);//no longer being held but still in inventory
            }

            //put on the new item
            this.doer.equipment.set(slot, this.item);
            addItemStats(this.doer, this.item);//wearing the item boosts the doer's stats

            let putOnPutsOn;
            if (isPlayer) {
                putOnPutsOn = "put on";
            } 
            else {
                putOnPutsOn = "puts on";
            }
            logMessage(doerName + " " + putOnPutsOn + " the " + itemName + ".");
        }

        if (this.doer === theCurrentPlayer)
        {
            new listInventoryAction(this.doer).execute();//show updated inventory
            updateEquipmentDisplayer();//show the newly equipped item in the equip slots box
        }
    }
}

class removeAction extends Action 
{
    constructor(doer, item) 
    {
        super(doer);
        this.item = item;
    }
    execute() 
    {
        const slot = this.item.slot;//like hand, body, etc
        const isPlayer = this.doer === theCurrentPlayer;//true if a human is the one removing the item
        const doerName = isPlayer ? "you" : "the " + this.doer.constructor.name.toLowerCase();//what to call the doer in the messages
        const itemName = this.item.constructor.name.toLowerCase();//the item's name in lowercase

        // hand items use the handItems list
        if (slot === "hand")
        {
            const index = this.doer.handItems.indexOf(this.item);
            if (index === -1) // -1 means not found
            {
                logMessage(doerName + (isPlayer ? " are" : " is") + " not holding the " + itemName);
                return;
            }

            // remove from hands; item stays in inventory (children)
            this.doer.handItems.splice(index, 1);
            subtractItemStats(this.doer, this.item);//no longer getting this item's bonuses
            logMessage(doerName + (isPlayer ? " put away" : " puts away") + " the " + itemName);//still in inventory
        }
        //not hand items
        else if (slot) 
        {
            const currentItem = this.doer.equipment.get(slot);
            if (currentItem !== this.item)//if you try to unequip something not equiped
            {
                logMessage("the " + itemName + " is not equipped");
                return;
            }
            this.doer.equipment.delete(slot);
            subtractItemStats(this.doer, this.item);//no longer getting this item's bonuses
            logMessage(doerName + (isPlayer ? " take off" : " takes off") + " the " + itemName);
        }
        //can't be equipped
        else 
        {
            logMessage(doerName + " can't remove the " + itemName);
            return;
        }

        if (this.doer === theCurrentPlayer)
        {
            new listInventoryAction(this.doer).execute();//update inventory
            updateEquipmentDisplayer();//show the removed item's slot as "none"
        }
    }
}

//list of everything the entity currently has equipped
function getEquippedItems(entity) {
    const equippedItems = [];

    const wornItems = entity.equipment.values();
    for (const item of wornItems)
    {
        equippedItems.push(item);
    }

    const wieldedItems = entity.handItems;
    for (const item of wieldedItems)
    {
        equippedItems.push(item);
    }

    return equippedItems;
}

//list of the entity's items that can be equipped but aren't already equipped
function getWearableItems(entity) {
    const equipped = getEquippedItems(entity);//the items the entity already has on
    const wearableItems = [];//make an empty list to fill up

    const inventory = entity.children;//the items the entity is carrying
    for (const item of inventory) 
    {//loop through the whole inventory
        const canBeEquipped = item.slot !== null;
        const notAlreadyEquipped = !equipped.includes(item);//true if the item isn't already on
        if (canBeEquipped && notAlreadyEquipped)//if it can be equipped and isn't already
        {
            wearableItems.push(item);
        }
    }

    return wearableItems;
}

//add the stat bonuses of an equipped item to the entity that has it equipped
function addItemStats(doer, item) {
    doer.atk += item.atkBonus;
    doer.def += item.defBonus;
}

function subtractItemStats(doer, item) {
    doer.atk -= item.atkBonus;
    doer.def -= item.defBonus;
}

function isWalkable(level, x, y) {
    if (x < 0 || x >= level.map.width || y < 0 || y >= level.map.height) {
        return false;
    }
    if (level.map.get(x, y) !== " ") {
        return false;
    }
    const occupied = level.children.some(child => //can't move there if there's some entity in the way
        (child instanceof Player || child instanceof badGuy) &&
        child.x === x &&
        child.y === y
    );
    return !occupied;//if occupied is false, isWalkable is true (& vice versa)
}

function distanceBetween(a, b) {//distance between two entities
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function tryMove(monster, dx, dy) {//uses isWalkable to see if we can move the monster, then if so, run the action. used for fleeing and attacking monsters
    if (dx === 0 && dy === 0) return false;
    const level = monster.parent;
    if (!(level instanceof Level)) return false;
    const newX = monster.x + dx;
    const newY = monster.y + dy;
    if (isWalkable(level, newX, newY)) {
        new moveAction(monster, dx, dy).execute();
        return true;
    }
    return false;
}

function stepToward(monster, target) {//walk one step toward the target trying diagonal first then straight
    const dx = Math.sign(target.x - monster.x);
    const dy = Math.sign(target.y - monster.y);
    return tryMove(monster, dx, dy) ||
           tryMove(monster, dx, 0) ||
           tryMove(monster, 0, dy);
}

function stepAway(monster, target) {//walk one step away from the target; returns true if any direction worked
    const dx = Math.sign(monster.x - target.x);
    const dy = Math.sign(monster.y - target.y);
    return tryMove(monster, dx, dy) ||
           tryMove(monster, dx, 0) ||
           tryMove(monster, 0, dy);
}

function updateMonsterGoal(monster) {//the monster's goal is a small state machine: events can change it
    // a slime who has a low health starts fleeing instead of fighting
    if (monster instanceof slime && monster.goal === "attack" && monster.hp < monster.maxHp / 2) {
        monster.goal = "flee";
        logMessage("the " + monster.constructor.name + " starts fleeing.");//using "monster.constructor.name" even though this is hardcoded to slime just incase i change it at all later
    }
    // a treasure horder that is ignored gets angry when the player gets close
    if (monster instanceof treasureHoarder && monster.goal === "ignore" && distanceBetween(monster, theCurrentPlayer) <= 5) {
        monster.goal = "attack";
        logMessage("the " + monster.constructor.name + " gets angry and attacks.");
    }
}

function monstersTurn() {
    if (theCurrentLevel && theCurrentPlayer) {//failsafe
        const badGuys = theCurrentLevel.children.filter(child => child instanceof badGuy);//get list array of all monsters
        for (const monster of badGuys) {//for each monster
            updateMonsterGoal(monster);//check if each monster wants to change its goal first
            let actionTaken = false;

            //try to drop a carried item
            const inventory = monster.children;
            if (inventory.length > 0 && uniformrandom(9) === 0) { // 10% chance
                const itemToDrop = inventory[uniformrandom(inventory.length - 1)];//get an item from monster inventory
                itemToDrop.x = monster.x;//
                itemToDrop.y = monster.y;//drop the item onto the level where the monster was
                itemToDrop.parent = theCurrentLevel;//now on the level instead of the monster
                actionTaken = true;
                
                logMessage(monster.constructor.name + " dropped a " + itemToDrop.constructor.name.toLowerCase() + "!");
            }

            //try to pick up an item on the ground
            if (!actionTaken)//if the monster didn't drop anything
            {
                const itemsOnGround = theCurrentLevel.children.filter(child =>//find items the monster can pick up using .filter in a callback function
                    child.isPortable &&//checks if the item is portable
                    child.x === monster.x &&//checks if the item is at the same position as monster
                    child.y === monster.y &&//
                    monster.canPickUp(child)//checks if the monster can pick up the item
                );
                if (itemsOnGround.length > 0 && uniformrandom(1) === 0) { // 50% chance and if there actually is anything there
                    const itemToPick = itemsOnGround[uniformrandom(itemsOnGround.length - 1)];//get an item to pick up if there's multiple
                    itemToPick.parent = monster;//set the item's parent to the monster so it's carried
                    actionTaken = true;//the monster took an action

                    logMessage(monster.constructor.name + " picked up a " + itemToPick.constructor.name.toLowerCase() + "!");

                    //monster equips automatically when possible
                    if (monster.canWear(itemToPick)) 
                    {
                        new putOnAction(monster, itemToPick).execute();
                    }
                }
            }

            //if no picking up or putting down, act according to the monster's goal (instead of just randomly move)
            if (!actionTaken) {
                switch (monster.goal) {//switch statement to check monster's goal
                    case "follow"://friendly to the player so move towards the player using the new stepToward function
                        stepToward(monster, theCurrentPlayer);
                        break;

                    case "attack"://hostile monster
                        if (distanceBetween(monster, theCurrentPlayer) <= 1) {//within attack distance using new distanceBetween function
                            new attackAction(monster, theCurrentPlayer).execute();//attack the player
                            if (!theCurrentPlayer) return;//player died; stop the monster turn
                        } else {//too far away: move closer
                            stepToward(monster, theCurrentPlayer);
                        }
                        break;

                    case "flee"://run but fight back if cornered
                        const movedAway = stepAway(monster, theCurrentPlayer); //true if moving away happened
                        if (!movedAway && distanceBetween(monster, theCurrentPlayer) <= 1) {//backed into a corner
                            new attackAction(monster, theCurrentPlayer).execute();//fight back
                            if (!theCurrentPlayer) return;//player died; stop the monster turn
                        }
                        break;

                    case "ignore"://harmless so nothing and continue onto run the default fallback code
                    default:
                        // Generate a random step (-1, 0, or 1 in both dimensions)
                        const dx = uniformrandom(2) - 1;
                        const dy = uniformrandom(2) - 1;
                        if (dx !== 0 || dy !== 0) {//if the monster didn't stay in the same spot
                            const monsterMove = new moveAction(monster, dx, dy);//make a move action
                            monsterMove.execute();//do the move action (fails if the player is in the way; never becomes an attack)
                        }
                        break;
                }
            }
        }
        // Redraw the map display after monsters action
        drawLevel(theCurrentLevel, theCurrentDisplay);
    }
}

window.addEventListener("keydown", (event) => {
    if (!theCurrentPlayer || !theCurrentLevel) return;//so the user can still use wasd for their name before the gane loads

    if (isDropping) {//runs once the user has already clicked thr Q key to enter dropping mode, then clicked a number
        event.preventDefault();
        const key = event.key;//get the number
        const index = parseInt(key, 10) - 1;//correlate that number with which item the number represents
        const children = theCurrentPlayer.children;//get the item list

        let action = null;//for now
        if (!isNaN(index) && index >= 0 && index < children.length) {//check if it's a valid number
            action = new dropAction(theCurrentPlayer, children[index]);//create the drop action ("children[index]" is the item the number corresponds to)
        } 
        else //if not a valid number
        {
            logMessage("drop cancelled.");
        }
        isDropping = false;

        if (action !== null) //if something happened
        {
            action.execute();//now actually do the drop action

            // monsters (movement code)
            monstersTurn();
        }
        return;//since the purpose of this keyclick was to drop an item, we can just break out of the keydown event listener as it's served its purpose
    }

    if (isPuttingOn)//once user clicks p
    {
        event.preventDefault();
        const key = event.key;//get the number
        const index = parseInt(key, 10) - 1;//base 10
        const wearableItems = getWearableItems(theCurrentPlayer);//same list that was shown when the mode started

        let action = null;//for now
        if (!isNaN(index) && index >= 0 && index < wearableItems.length) {//check if it's a number that's positive and in range of length
            action = new putOnAction(theCurrentPlayer, wearableItems[index]);//create the put on action
        } 
        else //if not a valid number
        {
            logMessage("put on cancelled.");
        }
        isPuttingOn = false;

        if (action !== null) //if something happened
        {
            action.execute();//now actually do the put on action
            monstersTurn();
        }
        return;//break out of keydown event listener
    }

    if (isRemoving) 
    {
        event.preventDefault();
        const key = event.key;
        const index = parseInt(key, 10) - 1;
        const equippedItems = getEquippedItems(theCurrentPlayer);

        let action = null;//for now
        if (!isNaN(index) && index >= 0 && index < equippedItems.length) 
        {
            action = new removeAction(theCurrentPlayer, equippedItems[index]);//create the remove action
        } 
        else
        {
            logMessage("remove cancelled.");
        }
        isRemoving = false;

        if (action !== null) //if something happened
        {
            action.execute();//now actually do the remove action
            monstersTurn();
        }
        return;
    }

    if (pendingAttackTarget) {//the player is deciding whether to attack an ignore/follow monster
        event.preventDefault();
        if (event.key === "y" || event.key === "Y") {
            const target = pendingAttackTarget;
            pendingAttackTarget = null;
            new attackAction(theCurrentPlayer, target).execute();//attacks the monster
            monstersTurn();
        } 
        else//so also if the player tries to walk away
        {
            logMessage("you leave the " + pendingAttackTarget.constructor.name + " alone.");
            pendingAttackTarget = null;
        }
        return;
    }

    let action = null; //instead of "let action;" to line if (action !== null) doesn't always run

    if (event.key === "w" || event.key === "W") 
    {//wasd for movement instead of arrow keys for universal controls with other games + natural hand placement + some keyboard don't have arrow keys
        action = new moveAction(theCurrentPlayer, 0, -1);//now defining which specific thing gets moved instead of hardcoded to player
    } 
    else if (event.key === "s" || event.key === "S") 
    {
        action = new moveAction(theCurrentPlayer, 0, 1);
    } 
    else if (event.key === "a" || event.key === "A") 
    {
        action = new moveAction(theCurrentPlayer, -1, 0);
    } 
    else if (event.key === "d" || event.key === "D") 
    {
        action = new moveAction(theCurrentPlayer, 1, 0);
    } 
    else if (event.key === ",") 
    {
        action = new pickupAction(theCurrentPlayer);
    } 
    else if (event.key === "<") 
    {
        action = new climbStairsAction(theCurrentPlayer);
    } 
    else if (event.key === ">") 
    {
        action = new goDownAction(theCurrentPlayer);
    } 
    else if (event.key === "i" || event.key === "I") 
    {
        action = new listInventoryAction(theCurrentPlayer);//also list inventory whenever the I key is peessed
    } 
    else if (event.key === "q" || event.key === "Q") 
    {
        const children = theCurrentPlayer.children;//get the list of the player's children
        if (children.length === 0) 
        {
            logMessage("you have nothing to drop!");
        } 
        else 
        {
            isDropping = true;
            logMessage("select item to drop (press 1-" + children.length + ") or any other key to cancel:");
            new listInventoryAction(theCurrentPlayer).execute();//lists the inventory so you know which number to press
        }
        event.preventDefault();//making sure the browser doesn't do anything
        return;
    } 
    else if (event.key === "p" || event.key === "P") 
    {
        const wearableItems = getWearableItems(theCurrentPlayer);//items that can be equipped and aren't already
        if (wearableItems.length === 0) 
        {
            logMessage("you have nothing you can wear or wield!");
        } 
        else 
        {
            const equippedItems = getEquippedItems(theCurrentPlayer);//what the player already has on
            if (equippedItems.length === 0) 
            {
                logMessage("you are wearing and weilding nothing");
            } 
            else 
            {
                logMessage("You are wearing / wielding:\n" + equippedItems.map(item => item.constructor.name.toLowerCase()).join("\n"));//list just the names
            }
            //numbered list of the wearable but not equipped items
            let carryingList = "You are carrying:\n";
            for (let idx = 0; idx < wearableItems.length; idx++) {//all wearable items
                const item = wearableItems[idx];
                const itemName = item.constructor.name.toLowerCase();
                carryingList += (idx + 1) + ". " + itemName;//add a numbered line like "1. helmet"
                if (idx < wearableItems.length - 1)//if this isn't the last item then add a new line in between items
                {
                    carryingList += "\n";
                }
            }
            logMessage(carryingList);
            logMessage("which item would you like to equip? (press 1-" + wearableItems.length + " or any other key to cancel):");
            isPuttingOn = true;
        }
        event.preventDefault();//making sure the browser doesn't do anything
        return;
    } 
    else if (event.key === "r" || event.key === "R") 
    {
        const equippedItems = getEquippedItems(theCurrentPlayer);//what the player has on
        if (equippedItems.length === 0) 
        {
            logMessage("you have nothing to remove!");
        } 
        else 
        {
            let wornList = "You are wearing / wielding:\n";
            for (let idx = 0; idx < equippedItems.length; idx++) {//loop through each currently equipped item
                const item = equippedItems[idx];
                const itemName = item.constructor.name.toLowerCase();
                wornList += (idx + 1) + ". " + itemName;
                if (idx < equippedItems.length - 1)
                {
                    wornList += "\n";
                }
            }
            logMessage(wornList);//numbered list of what's equipped
            logMessage("which item would you like to remove? (press 1-" + equippedItems.length + " or any other key to cancel):");
            isRemoving = true;
        }
        event.preventDefault();//making sure the browser doesn't do anything
        return;
    }

    if (action !== null) {//if a random other button wasn't clicked
        event.preventDefault();
        action.execute();//send in the movement code

        if (pendingAttackTarget) {
            return;//an attack prompt is showing so the monsters wait for the player's answer (which includes any button other than y as no)
        }

        // monsters' turn.
        monstersTurn();
    }
});
