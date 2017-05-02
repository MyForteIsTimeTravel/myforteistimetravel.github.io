/* * * * * * * * * * * * * * * * * *
 *  Grid Mesh Animation (baked.js)
 *
 *  Ryan Needham
 * * * * * * * * * * * * * * * * * */
(function () {
        
    /* * * * * * * * * * * * * * * * * *
     * Control
     * * * * * * * * * * * * * * * * * */
    var banner1   = document.getElementById("container")
    var animating = false
    var automated = false
    
    banner1.addEventListener("mouseover", function () { animating = true  })
    banner1.addEventListener("mouseout",  function () { animating = false })
    
    /* * * * * * * * * * * * * * * * * * 
     * CONTEXT
     * * * * * * * * * * * * * * * * * */
    var canvas      = document.getElementById("heroCanvas")
    canvas.width    = window.innerWidth
    canvas.height   = window.innerHeight
    
    var gl          = canvas.getContext('webgl')
    gl.clearColor   (0.21, 0.21, 0.21, 1.0)
    gl.clear        (gl.COLOR_BUFFER_BIT)
    gl.enable       (gl.DEPTH_TEST)
    gl.enable       (gl.CULL_FACE)
    gl.frontFace    (gl.CCW)
    gl.cullFace     (gl.BACK)
    
    window.addEventListener('resize', resizeCallback, false)
    function resizeCallback () {
        // just reload to adjust
        location.reload();
    }

    /* * * * * * * * * * * * * * * * * * 
     * SHADERS
     * * * * * * * * * * * * * * * * * */
    var vert = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(vert, [
        'attribute vec3 vertPos;',
        'varying vec3 fragCol;',
        'uniform mat4 model;',
        'uniform mat4 view;',
        'uniform mat4 projection;',
        'uniform float amp;',
        'float rand(vec2 co) { return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }',
        'void main (void) {',
            'gl_Position = projection * view * model * vec4(vertPos.x, vertPos.y * amp, vertPos.z, 1.0);',
        '}'
    ].join('\n'))
    gl.compileShader(vert)
    if (!gl.getShaderParameter(vert, gl.COMPILE_STATUS)) {
        console.error('ERROR compiling vertex shader: ', gl.getShaderInfoLog(vert))
    }

    var frag = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(frag, [
        'precision highp float;',
        'void main (void) {',
            'gl_FragColor = vec4(0, 0, 0, 1.0);',
        '}'
    ].join('\n'))
    gl.compileShader(frag)
    if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
        console.error('ERROR compiling fragment shader: ', gl.getShaderInfoLog(frag))
    }

    // Program
    var shader = gl.createProgram()
    gl.attachShader (shader, vert)
    gl.attachShader (shader, frag)
    gl.linkProgram  (shader)

    /* * * * * * * * * * * * * * * * * * 
     * GRID / FLOOR MESH
     * * * * * * * * * * * * * * * * * */
    var width      = 100
    var height     = 100
    var startX     = (width  / 2) * -1
    var endZ       = (height / 2) * -1
    var xIndex     = 0
    var zIndex     = height
    var landscape  = []
    var step       = 0.25
    
    var simplex = new SimplexNoise();

    for (var x = startX; x < width; x += step * 2, xIndex++) {
        for (var z = height; z > endZ; z -= step * 2, zIndex--) {
            landscape.push(x - step)                                          // position x
            landscape.push(0.0 + simplex.noise2D(x - step, z + step))         // position y
            landscape.push(z + step)                                          // position z
            landscape.push(x - step)                                          // position x
            landscape.push(0.0 + simplex.noise2D(x - step, z - step))         // position y
            landscape.push(z - step)                                          // position z
            landscape.push(x + step)                                          // position x
            landscape.push(0.0 + simplex.noise2D(x + step, z + step))         // position y
            landscape.push(z + step)                                          // position z
            landscape.push(x + step)                                          // position x
            landscape.push(0.0 + simplex.noise2D(x + step, z + step))         // position y
            landscape.push(z + step)                                          // position z
            landscape.push(x - step)                                          // position x
            landscape.push(0.0 + simplex.noise2D(x - step, z - step))         // position y
            landscape.push(z - step)                                          // position z
            landscape.push(x + step)                                          // position x
            landscape.push(0.0 + simplex.noise2D(x + step, z - step))         // position y
            landscape.push(z - step)                                          // position z
        }
    }

    // Buffer Vertices Data
	var landscapeVBO = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, landscapeVBO)
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(landscape), gl.STATIC_DRAW)

	var positionAttribLocation = gl.getAttribLocation(shader, 'vertPos')
	gl.vertexAttribPointer (positionAttribLocation, 3, gl.FLOAT, gl.FALSE, 3 * Float32Array.BYTES_PER_ELEMENT, 0)
	gl.enableVertexAttribArray(positionAttribLocation)

    /* * * * * * * * * * * * * * * * * * 
     * TRANSFORMATION MATRICES
     * * * * * * * * * * * * * * * * * */
    gl.useProgram(shader)
    
    // view transform
    var view    = new Float32Array(16)
    var viewLoc = gl.getUniformLocation(shader, 'view')
    mat4.lookAt(
        view, 
        [0, 2, -5],    // position 
        [0, 0, 1000],  // forward
        [0, 1, 0]      // up
    )

    // projection transform
    var projection    = new Float32Array(16)
    var projectionLoc = gl.getUniformLocation(shader, 'projection')
    mat4.perspective(
        projection,
        glMatrix.toRadian(60),        // fov
        canvas.width / canvas.height, // aspect
        0.01,                         // near
        25                            // far
    )

    gl.uniformMatrix4fv(viewLoc, gl.FALSE, view)
    gl.uniformMatrix4fv(projectionLoc, gl.FALSE, projection)

    /* * * * * * * * * * * * * * * * * * 
     * MAIN LOOP
     * * * * * * * * * * * * * * * * * */
    var identity = new Float32Array(16)
    var angle    = 0
    var camZ     = -5
    var amp      = 0
    let ampMax   = 0.40

    mat4.identity(identity)

    function update () {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.useProgram(shader)

        /** 
         *  Model Transform 
         */
        var model    = new Float32Array(16)
        var xRot     = new Float32Array(16)
        var zRot     = new Float32Array(16)
        var scale    = new Float32Array(16)
        mat4.rotate (xRot, identity, angle, [0, 1, 0])
        mat4.rotate (zRot, identity, angle, [1, 0, 0])
        mat4.scale  (scale, identity, [0.75, 0.75, 0.75])
        mat4.mul    (model, xRot, zRot)
        mat4.mul    (model, model, scale)

        // pass uniforms to GPU
        gl.uniformMatrix4fv(gl.getUniformLocation(shader, 'model'), gl.FALSE, model)

        /**
         *  View Transform
         *  
         *  move camera forward and 
         *  reset when needed
         */
        if (camZ > 60) camZ = 0;
        camZ += 0.032
        mat4.lookAt(
            view, 
            [0, 1, camZ],  // position 
            [0, 0, 1000],  // forward
            [0, 1, 0]      // up
        );
        
        // pass to gpu
        gl.uniformMatrix4fv(viewLoc, gl.FALSE, view)
        
        /** 
         * Animation Data
         */
        if (animating && amp < ampMax) amp += (ampMax - amp) * 0.05; 
        else if (amp > 0) amp -= 0.01
        if (window.innerWidth < 760) automated = true;
        else automated = false;
        if (automated) {
            amp += 0.025
            gl.uniform1f(gl.getUniformLocation(shader, 'amp'), Math.cos(amp)*0.5)
        } else {
            gl.uniform1f(gl.getUniformLocation(shader, 'amp'), amp)   
        }
        
        /** render */
        gl.drawArrays(gl.LINES, 0, landscape.length / 3)   
        requestAnimationFrame(update)
    }
    requestAnimationFrame(update);   
}());