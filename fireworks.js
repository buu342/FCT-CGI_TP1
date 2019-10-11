/**
 * CGI Project 1 - Firework display
 * By Lourenço Soares (54530)
 */
 
/*====================================
           Global Variables
====================================*/

// Shader and WebGL variables
var gl; 
var programDefault;     // Background + Line shaders
var programParticles;   // Particle System shaders
var ynormal;            // Aspect ratio

// Timer variables
var StartTime = (new Date()).getTime(); // Needed to subtract from CurTime because JS is 64 bit and GLSL is 32
var CurTime;
var PrevTime;

// Mouse variables
var isDrawing;
var mouseStartPos;
var mouseEndPos;

// Particle variables
var autofire_enabled;
var autofire_nextfire;
var part_count; 
var part_array; // 2 floats for starting pos, 3 floats for color, 8 floats for data


/*====================================
          Program Constants
 Change if you know what you're doing
====================================*/

const SECOND    = 1000;
const FLOATSIZE = 4;


/*====================================
      Particle System Constants
            Change for fun
====================================*/

const RESIZE_CANVAS    = true; // Resize the canvas to fit the window 

// General particle system constants
const MAXPARTICLES     = 65000; 
const GRAVITY          = 0.75;
const AUTOFIRE_MINTIME = 1*SECOND;
const AUTOFIRE_MAXTIME = 3*SECOND;

// Rocket/Mortar constants
const MORTAR_VELOCITYMULT = 2.0;
const MORTAR_SIZE         = 10.0;
const ROCKET_MINVEL       = 0.3;
const ROCKET_MAXVEL       = 1.7;
const ROCKET_SIZE         = 10.0;

// Flare constants
const FLARE_MINIMUM           = 10;
const FLARE_MAXIMUM           = 30;
const FLARE_VELOCITYMULT      = 0.5;
const FLARE_MINLIFE           = 0.5*SECOND;
const FLARE_MAXLIFE           = 2.0*SECOND;
const FLARE_SIZE              = 5.0;
const FLARE_RECURSIVE         = 2.0; // How many times to recursively call the explosion (WARNING: this will raise the number of flares to the power of this value!)
const FLARE_SPEEDADDITIVE     = true; // Make the recursive flare speeds add up (so momentum is conserved)

// Flame constants
const FLAME_ENABLE      = true;
const FLAME_SIZE        = 10.0;
const FLAME_MAXLIFETIME = 0.5*SECOND;

// Flash constants
const FLASH_ENABLE   = true;
const FLASH_SIZE     = 200.0;
const FLASH_LIFETIME = 0.2*SECOND;


/*====================================
          Shader Constants
 Change if you know what you're doing
====================================*/

// Object types
const OBJ_ROCKET = 0.0;
const OBJ_MORTAR = 1.0;
const OBJ_FLARE  = 2.0;
const OBJ_FLAME  = 3.0;
const OBJ_FLASH  = 4.0;

// Attribute data sizes
const SIZE_POS   = 2;
const SIZE_COL   = 3;
const SIZE_INFO  = 4;  
const SIZE_INFO2 = 4;  
const SIZE_VERT  = SIZE_POS+SIZE_COL;
const SIZE_PART  = (SIZE_VERT+SIZE_INFO+SIZE_INFO2)

// Particle data structure
const ARRAY_XPOS    = 0;
const ARRAY_YPOS    = 1;
const ARRAY_COLR    = 2;
const ARRAY_COLG    = 3;
const ARRAY_COLB    = 4;
const ARRAY_OBJ     = 5;
const ARRAY_TIME    = 6;
const ARRAY_DIETIME = 7;
const ARRAY_SIZE    = 8;
const ARRAY_XVEL    = 9;
const ARRAY_YVEL    = 10;
const ARRAY_GRAV    = 11;


/*====================================
           Useful functions
====================================*/

// Calculate a random value between a range
function random_range(min, max)
{
    return min+Math.random()*(max-min);
}


/*====================================
        Mouse Event functions
====================================*/

// What to do when a mouse button is pressed
function handle_mouse_down(e)
{
    var leftclick = e.button == 0;
    var midclick = e.button == 1;
    var rightclick = e.button == 2;
    
    if (leftclick)
    {
        isDrawing = true;
        mouseStartPos = get_mouse_pos(e);
        mouseEndPos = mouseStartPos;
    }
}

// What to do when the mouse button is released
function handle_mouse_up(e)
{
    var leftclick = e.button == 0;
    var midclick = e.button == 1;
    var rightclick = e.button == 2;
    
    if (leftclick && isDrawing)
    {
        isDrawing = false;
        launchMortar();
    }
}

// What to do when the mouse leaves the canvas
function handle_mouse_out(e)
{
    handle_mouse_up(e)
}

// Return the mouse position as a vec2
function get_mouse_pos(e)
{
    var canvas = document.getElementById("gl-canvas");
    var w = canvas.width;
    var h = canvas.height;
    return vec2(-(w/2-e.clientX)/(w/2), (h/2-e.clientY)/(h/2));
}

// What to do when the mouse is moved
function handle_mouse_move(e)
{
    if (isDrawing)
        mouseEndPos = get_mouse_pos(e);
}

// What to do when a key is pressed
function handle_key_down(e)
{
    var spacebar = e.keyCode == 32;

    // Toggle autofire if we pressed the spacebar
    if (spacebar)
        autofire_enabled = !autofire_enabled;
}


/*====================================
         WebGL Initialization
====================================*/

// Swap program to the passed one and return the program that was changed to
function changeProgram(program)
{
    // Ensure we're not changing program to one we're already using
    if (gl.getParameter(gl.CURRENT_PROGRAM) == program)
    {
        updateShaderUniforms()
        return program;
    }
    
    // Use the program and update the uniforms
    gl.useProgram(program);
    updateShaderUniforms()
    
    // Return the program we changed to
    return program;
}

// Update the uniforms when the shaders are changed
function updateShaderUniforms()
{
    var program = gl.getParameter(gl.CURRENT_PROGRAM)
    
    // Pass the resolution of the canvas to the fragment shader
    var vResolution = gl.getUniformLocation(program, "vResolution");
    gl.uniform2f(vResolution, gl.canvas.width, gl.canvas.height);
    
    // Pass the current time to the shaders
    var vTime = gl.getUniformLocation(program, "vTime");
    gl.uniform1f(vTime, CurTime);  
}

// Resize the canvas to fit the window
function resizeCanvas() 
{
    // If we don't have canvas resizing enabled, don't bother running this function
    if (!RESIZE_CANVAS)
        return;
    
    // Get the current window size
    var canvas = document.getElementById("gl-canvas");
    var w = window.innerWidth   ;
    var h = window.innerHeight;

    // Change the canvas if we changed the size
    if (canvas.width != w || canvas.height != h) 
    {
        canvas.width = w;
        canvas.height = h;
        ynormal = w/h;
          
        gl.viewport(0, 0, w, h);
    }
}

// Initialize everything
window.onload = function init() 
{
    // Start WebGL
    var canvas = document.getElementById("gl-canvas");
    gl = WebGLUtils.setupWebGL(canvas);
    
    // Error if we have a problem
    if(!gl) 
        alert("WebGL isn't available");
    
    // Initialize some globals
    ynormal = 1.0;
    autofire_enabled = true;
    fps_after = 0;
    fps_before = 0;
    CurTime = (new Date()).getTime()-StartTime;
    PrevTime = CurTime;
    autofire_nextfire = CurTime+random_range(AUTOFIRE_MINTIME, AUTOFIRE_MAXTIME);
    
    // Initialize the particle system
    part_count = 0.0;
    part_array = [];
    
    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    resizeCanvas();
    
    // Load the shaders and set the default program
    programDefault = initShaders(gl, "vertex-shader-default", "fragment-shader-default");
    programParticles = initShaders(gl, "vertex-shader-particles", "fragment-shader-particles");
    changeProgram(programDefault);
    
    // Add Event Listeners to handle canvas interaction
    canvas.addEventListener('mousedown', handle_mouse_down);
    canvas.addEventListener('mouseup', handle_mouse_up);
    canvas.addEventListener('mousemove', handle_mouse_move);
    canvas.addEventListener('mouseout', handle_mouse_out);
    window.addEventListener('keydown', handle_key_down);
    window.addEventListener('resize', resizeCanvas);
    
    // Render the scene
    renderScene();
}


/*====================================
          Particle Creation
====================================*/

// Launch a mortar when the mouse is released
function launchMortar()
{
    // Calculate physics based on the vector created from the mouse
    var pos = vec2(mouseStartPos[0], mouseStartPos[1])
    var col = vec3(Math.random(), Math.random(), Math.random());
    var vel = vec2((mouseEndPos[0]-mouseStartPos[0])*MORTAR_VELOCITYMULT/Math.sqrt(1/ynormal), (mouseEndPos[1]-mouseStartPos[1])*MORTAR_VELOCITYMULT/Math.sqrt(ynormal));
    var lifetime = Math.max(0,(vel[1]/GRAVITY)*SECOND);
    
    // Create the mortar
    particleCreate(OBJ_MORTAR, 
        pos, col,
        lifetime, 0.0,
        vel, MORTAR_SIZE
    );
   
    // Make some flares when the mortar hit the maximum height
    generateFlares(pos, vel, col, lifetime, 1);
}

// Launch a rocket from the bottom of the screen
function launchRocket()
{
    // Generate random physics values
    var yvel = random_range(ROCKET_MINVEL, ROCKET_MAXVEL)
    var pos = vec2(1-Math.random()*2, -1.0)
    var col = vec3(Math.random(), Math.random(), Math.random());
    var vel = vec2(0, yvel/Math.sqrt(ynormal));
    var lifetime = (vel[1]/GRAVITY)*SECOND;
    
    // Create the Rocket
    particleCreate(OBJ_ROCKET, 
        pos, col,
        lifetime, 0.0,
        vel, ROCKET_SIZE
    );
    
    // Make some flares when the mortar hit the maximum height
    generateFlares(pos, vel, col, lifetime, 1); 
}

// Create an explosion of flares, recursively.
function generateFlares(pos, vel, col, delay, recursive)
{
    // If we hit the recursive limit, don't go any further
    if (recursive > FLARE_RECURSIVE)
        return;
    
    // Decide how many flares to create
    var numparts = random_range(FLARE_MINIMUM, FLARE_MAXIMUM);
    
    // If we're on our first recursive iteration, calculate new positions for the flares, otherwise use the passed positions
    var newpos;
    if (recursive == 1)
    {
        var physicsTime = delay/SECOND;
        var posx = pos[0] + vel[0]*physicsTime;
        var posy = pos[1] + (vel[1]*physicsTime - 0.5*GRAVITY*Math.pow(physicsTime, 2))*ynormal;
        newpos = vec2(posx, posy); 
    }
    else
        newpos = pos
    
    // Create a flash, with a delay
    if (FLASH_ENABLE)
    {
        particleCreate(OBJ_FLASH, 
            newpos, vec3(1.0, 1.0, 1.0),
            FLASH_LIFETIME, delay,
            vec2(0.0, 0.0), FLASH_SIZE
        );
    }

    // Create the flares, also with a delay
    for (var i=0; i<numparts; i++)
    {
        // Generate random velocities within a circle
        var maxvel = Math.sqrt(Math.random())*FLARE_VELOCITYMULT;
        var angle = 2*Math.PI*Math.random()
        var newervel = vec2((Math.cos(angle)*maxvel), Math.sin(angle)*maxvel);
        var flarelife = random_range(FLARE_MINLIFE, FLARE_MAXLIFE);
        
        // If we throw a mortar downwards, send in the downwards speed as well
        if (vel[1] < 0)
            newervel[1] = newervel[1] + vel[1];
        
        // Add speed if the setting is enabled
        if (FLARE_SPEEDADDITIVE)
            newervel[0] += vel[0];
        
        // Create new particles
        particleCreate(OBJ_FLARE, 
            newpos, col,
            flarelife, delay,
            newervel, FLARE_SIZE
        );
        
        // If we don't wish to perform recursive explosions, ignore the next block of code
        if (FLARE_RECURSIVE == 1.0)
            continue;
        
        // Make a recursive explosion
        var newerposx = newpos[0]+newervel[0]*flarelife/SECOND;
        var newerposy = newpos[1]+newervel[1]*flarelife/SECOND-0.5*GRAVITY*Math.pow(flarelife/SECOND, 2);
        var newerpos = vec2(newerposx, newerposy);
        
        // If we want to add to the current velocities, do that instead of making new velocities
        var newerervel = {}
        if (FLARE_SPEEDADDITIVE)
        {
            newerervel[0] = newervel[0];
            newerervel[1] = newervel[1];
        }
        else
            newerervel = vec2(Math.cos(angle)*maxvel, Math.sin(angle)*maxvel);
        
        // Generate even more flares, recursively
        generateFlares(newerpos, newerervel, col, delay+flarelife, recursive+1);        
    } 
}

// Generate flames out of the rocket, based on its speed
function generateFlames()
{
    // If flames aren't enabled, don't bother running this function
    if (!FLAME_ENABLE)
        return;
    
    var canvas = document.getElementById("gl-canvas");
    
    // Iterate through all the particles
    for (var i=0; i<MAXPARTICLES*SIZE_PART; i+=SIZE_PART)
    {
        // If we found a rocket
        if (part_array[i+ARRAY_OBJ] == OBJ_ROCKET)
        {
            // Calculate its current velocity
            var physicsTime = (CurTime-part_array[i+ARRAY_TIME])/SECOND;
            var yvel = part_array[i+ARRAY_YVEL] - GRAVITY*physicsTime;
            
            // Make the flame particle less likely to appear if the rocket is dying
            if (yvel < 0.3 || yvel/part_array[i+ARRAY_YVEL] < (part_array[i+ARRAY_YVEL]*Math.random()))
                continue;
                        
            // Calculate all the positions and velocities to make sure the flames don't overlap the rocket
            var xrandpos = random_range(-1, 1);
            var xoffset = (ROCKET_SIZE*xrandpos)/canvas.width;
            var yoffset = (part_array[i+ARRAY_YVEL]*physicsTime - 0.5*GRAVITY*Math.pow(physicsTime, 2.0))*ynormal-FLAME_SIZE/canvas.height;
            var pos = vec2(part_array[i+ARRAY_XPOS]+xoffset, part_array[i+ARRAY_YPOS]+yoffset-Math.sin(Math.PI*(1+xrandpos)/2)*ROCKET_SIZE/canvas.height);
            var vel = vec2(xrandpos/10, -0.5);
            
            // Create the flame particle
            particleCreate(OBJ_FLAME, 
                pos, vec3(0.0, 0.0, 0.0),
                FLAME_MAXLIFETIME*(yvel/part_array[i+ARRAY_YVEL]), 0.0,
                vel, FLAME_SIZE
            );
        }
    }
}


/*====================================
           Object Handling
====================================*/

// Create a particle
function particleCreate(type, pos, col, lifetime, delay, vel, size)
{
    // Create an auxillary array to help our for loops
    var data = [
        pos[0], pos[1], col[0], col[1], col[2],
        type, CurTime+delay, CurTime+delay+lifetime, size,
        vel[0], vel[1], GRAVITY, 0.0
    ];
    
    // If we hit the particle limit, replace the oldest particle, otherwise make new ones
    if (part_count == MAXPARTICLES)
    {
        var oldestTime = CurTime;
        var oldestIndex = -1;
        
        // Find the oldest particle
        for (var i=0; i<MAXPARTICLES*SIZE_PART; i+=SIZE_PART)
        {
            if (oldestIndex == -1 || part_array[i+ARRAY_TIME] < oldestTime)
            {
                oldestIndex = i;
                oldestTime = part_array[i+ARRAY_TIME];
            }
        }
        
        // Replace it with our new particle
        for (var i=0; i<SIZE_PART; i++)
            part_array[oldestIndex+i] = data[i];
    }
    else
    {
        // Create the new particle
        part_count++;
        for (var i=0; i<SIZE_PART; i++)
            part_array[(part_count-1)*SIZE_PART+i] = data[i];
    }
}

// Clean up particles that are no longer alive
function particlesCleanup()
{
    // Remove particles that are past their lifetime
    for (var i=0; i<MAXPARTICLES*SIZE_PART; i+=SIZE_PART)
        if (part_array[i+ARRAY_DIETIME] < CurTime)
            for (var j=0; j<SIZE_PART; j++)
                part_array[i+j] = null;
    
    // Filter out NULL values and update the particle count
    part_array = part_array.filter(
        function (el) 
        {
          return el != null;
        }
    ); 
    part_count = (part_array.length)/SIZE_PART;
}


/*====================================
              Rendering
====================================*/

// Create a buffer, binding the data we pass into the function to said buffer, and return the created buffer
function createBuffer(data) 
{
    // Create a new buffer (the Garbage Collector will remove the old buffer)
    var buffer = gl.createBuffer(); 
    
    // Make sure the buffer exists
    if (!buffer) 
    {
        alert("Failed to create the buffer object");
        return null;
    }

    // Set the array buffer to the new buffer and return it
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(data), gl.STATIC_DRAW);
    
    return buffer;
}

// Render our twinkling night sky
function renderBackground()
{
    // Define our background
    var bac = [
        -1.0, -1.0,
        0.0, 0.0, 0.1,
        -1.0, 1.0,
        0.0, 0.0, 0.0,
        1.0, -1.0,
        0.0, 0.0, 0.1,
        1.0, 1.0,
        0.0, 0.0, 0.0,
    ];
    
    // Set the program
    var program = changeProgram(programDefault);
    
    // Create a buffer and fill it with the background array
    createBuffer(bac);
    
    // Explain how the data is packed
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, SIZE_POS, gl.FLOAT, false, FLOATSIZE*SIZE_VERT, 0); 
    gl.enableVertexAttribArray(vPosition);
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, SIZE_COL, gl.FLOAT, false, FLOATSIZE*SIZE_VERT, FLOATSIZE*SIZE_POS);
    gl.enableVertexAttribArray(vColor);
    
    // Render the background
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// Render all the particles on the screen
function renderParticles()
{
    // If no particles exist, don't bother running this function
    if (part_count == 0)
        return;
    
    var program = changeProgram(programParticles);
    
    // Turn on additive blending
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    
    // Create a buffer and fill it with the particles array
    createBuffer(part_array);
    
    // Explain how the data is packed
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, SIZE_POS, gl.FLOAT, false, FLOATSIZE*SIZE_PART, 0); 
    gl.enableVertexAttribArray(vPosition);
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, SIZE_COL, gl.FLOAT, false, FLOATSIZE*SIZE_PART, FLOATSIZE*SIZE_POS);
    gl.enableVertexAttribArray(vColor);
    var vInfo = gl.getAttribLocation(program, "vInfo");
    gl.vertexAttribPointer(vInfo, SIZE_INFO, gl.FLOAT, false, FLOATSIZE*SIZE_PART, FLOATSIZE*(SIZE_VERT)); 
    gl.enableVertexAttribArray(vInfo);
    var vInfo2 = gl.getAttribLocation(program, "vInfo2");
    gl.vertexAttribPointer(vInfo2, SIZE_INFO, gl.FLOAT, false, FLOATSIZE*SIZE_PART, FLOATSIZE*(SIZE_VERT+SIZE_INFO)); 
    gl.enableVertexAttribArray(vInfo2);
    
    // Render the particles
    gl.drawArrays(gl.POINTS, 0, part_count);
    
    // Turn off additive blending
    gl.blendFunc(gl.ONE, gl.ZERO);
}

// Render the mortar trajectory line 
function renderLine() 
{
    // If we're not drawing a line, don't bother running this function
    if (!isDrawing)
        return;
    
    var program = changeProgram(programDefault);
    
    // Define the line array
    var line_array = [
        mouseStartPos[0], mouseStartPos[1], 
        1.0, 1.0, 0.0,
        
        mouseEndPos[0], mouseEndPos[1],
        1.0, 1.0, 0.0,
    ];
    
    // Create a buffer and fill it with the line array
    createBuffer(line_array);
    
    // Explain how the data is packed
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, SIZE_POS, gl.FLOAT, false, FLOATSIZE*SIZE_VERT, 0);
    gl.enableVertexAttribArray(vPosition);
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, SIZE_COL, gl.FLOAT, false, FLOATSIZE*SIZE_VERT, FLOATSIZE*SIZE_POS);
    gl.enableVertexAttribArray(vColor);
    
    // Render the line
    gl.drawArrays(gl.LINES, 0, 2);
}

// Change the text on the top left
function renderText()
{
    var textElement = document.getElementById("text");
    var fps = Math.round(SECOND/(CurTime - PrevTime));
    textElement.textContent = "FPS: "+fps+"\r\nParticles: "+part_count+"\r\nAuto fire: "+autofire_enabled;
}

// Render the entire fireworks show
function renderScene() 
{
    // Get the program and update the current time
    var program = gl.getParameter(gl.CURRENT_PROGRAM);
    CurTime = (new Date()).getTime()-StartTime;
    
    // Cleanup the particles array
    particlesCleanup();
    
    // Create rockets at random
    if (autofire_nextfire < CurTime)
    {
        autofire_nextfire = CurTime+random_range(AUTOFIRE_MINTIME, AUTOFIRE_MAXTIME);
        if (autofire_enabled)
            launchRocket();
    }

    // Generate some flame particles if needed
    generateFlames()
    
    // Clear the frame buffer
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Render the canvas elements
    renderBackground();
    renderParticles();
    renderLine();
    renderText();

    // Get the old time for later reference
    PrevTime = CurTime;
    
    // Call this function again
    window.requestAnimFrame(renderScene);
}