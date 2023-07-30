const main = document.querySelector('main');
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const cursor = document.querySelector('#cursor');

const transform = {
    x: 0,
    y: 0,
    z: 1,
    mouseDrag: false,
    touches: [],
    clientToCanvas(x, y) {
        let canvasX = Math.floor( (x - this.x) / this.z );
        let canvasY = Math.floor( (y - this.y) / this.z );
        return { x: canvasX, y: canvasY };
    },
    pointerdownHandler(e) {
        if (e.pointerType === 'mouse') {
            this.mouseDrag = true;
        } else {
            e.newX = e.clientX;
            e.newY = e.clientY;
            this.touches.push(e);
        };
        main.classList.add('grabbing');
    },
    pointerupHandler(e) {
        if (e.pointerType === 'mouse') {
            this.mouseDrag = false;
        } else {
            const i = this.touches.findIndex(element => element.pointerId === e.pointerId);
            this.touches.splice(i, 1);
        };
        main.classList.remove('grabbing');
    },
    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        canvas.style.left = `${x}px`;
        canvas.style.top = `${y}px`;
        canvas.style.width = `${z * canvas.width}px`;
    },
    transformHandler(e) {
        let x = this.x;
        let y = this.y;
        let z = this.z;
        if (e.pointerType === 'mouse' || e.type === 'wheel') {
            if (this.mouseDrag) {
                x += e.movementX;
                y += e.movementY;
            } else if (e.type === 'wheel') {
                x = (e.clientX - x) / z;
                y = (e.clientY - y) / z;
                const scale = 1.2;
                if (e.deltaY < 0) {
                    z *= scale;
                } else {
                    z /= scale;
                };
                x = e.clientX - x * z;
                y = e.clientY - y * z;
            };
            const coords = transform.clientToCanvas(e.clientX, e.clientY);
            cursor.style.left = `${coords.x * z + x}px`;
            cursor.style.top = `${coords.y * z + y}px`;
            cursor.style.width = `${z}px`;
        } else {
            const i = this.touches.findIndex(element => element.pointerId === e.pointerId);
            const touch1 = this.touches[i];
            x += e.clientX - touch1.newX;
            y += e.clientY - touch1.newY;
            if (this.touches.length === 2) {
                const j = (i === 0 ? 1 : 0);
                const touch2 = this.touches[j];
                const midpoint = {
                    x: (e.clientX + touch2.newX) / 2,
                    y: (e.clientY + touch2.newY) / 2
                };
                x = (midpoint.x - x) / z;
                y = (midpoint.y - y) / z;
                const newDist = Math.hypot(
                    e.clientX - touch2.newX,
                    e.clientY - touch2.newY
                );
                const oldDist = Math.hypot(
                    touch1.newX - touch2.newX,
                    touch1.newY - touch2.newY
                );
                const scale = newDist / oldDist;
                z *= scale;
                x = midpoint.x - x * z;
                y = midpoint.y - y * z;
            };
            touch1.newX = e.clientX;
            touch1.newY = e.clientY;
        };
        this.set(x, y, z);
    }
};

main.addEventListener('pointerdown', e => transform.pointerdownHandler(e) );
main.addEventListener('pointerup', e => transform.pointerupHandler(e) );
main.addEventListener('pointermove', e => transform.transformHandler(e) );
main.addEventListener('wheel', e => transform.transformHandler(e) );

let ws;
let color;
let receivedColors = false;
const numberOfUsers = document.querySelector('#number-of-users');
function connect() {
    ws = new WebSocket('wss://multiplayer-pixel-art-backend.onrender.com');
    ws.onopen = () => {
        ws.onmessage = e => {
            const data = JSON.parse(e.data);
            if (data.msgType === 'canvas') {
                const width = data.width;
                canvas.width = width;
                canvas.height = width;
                const colors = data.colors;
                if (!receivedColors) {
                    receivedColors = true;
                    colors.forEach( (element, i) => {
                        const button = document.createElement('button');
                        if (i === 0) {
                            color = element;
                            button.classList.add('selected');
                        };
                        button.type = 'button';
                        button.style.backgroundColor = `#${element}`;
                        button.addEventListener('click', () => {
                            color = element;
                            document.querySelector('.selected').classList.remove('selected');
                            button.classList.add('selected');
                        });
                        document.querySelector('#colors').append(button);    
                    });
                };
                const buffer = data.buffer;
                const imageData = new ImageData(
                                      new Uint8ClampedArray(buffer.data),
                                      width
                );
                ctx.putImageData(imageData, 0, 0);
                let x = transform.x;
                let y = transform.y;
                let z = transform.z;
                if (window.innerWidth < window.innerHeight) {
                    y = (window.innerHeight - window.innerWidth) / 2;
                    z = window.innerWidth / canvas.width;
                    cursor.classList.add('hidden');
                } else {
                    x = (window.innerWidth - window.innerHeight) / 2;
                    z = window.innerHeight / canvas.width;
                };
                transform.set(x, y, z);
                const loadingScreen = document.querySelector('#loading-screen');
                loadingScreen.classList.add('transparent');
                setTimeout(() => loadingScreen.classList.add('hidden'), 300);
            } else if (data.msgType === 'pixel') {
                const imageData = ctx.createImageData(1, 1);
                const arr = imageData.data;
                const color = data.color;
                arr[0] = color.r;
                arr[1] = color.g;
                arr[2] = color.b;
                arr[3] = color.a;
                ctx.putImageData(imageData, data.x, data.y);
            } else if (data.msgType === 'user') {
                numberOfUsers.textContent = data.number;
            };
        };
        canvas.addEventListener('dblclick', e => {
            const pixel = transform.clientToCanvas(e.clientX, e.clientY);
            pixel.color = color;
            ws.send( JSON.stringify(pixel) );
        });
    };
    ws.onclose = () => {
        ws = null;
        numberOfUsers.textContent = 0;
        setTimeout(connect, 5000);
    };
};
connect();
