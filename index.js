import * as THREE from 'three';
import { VRButton } from 'VRButton';
import { RGBELoader } from 'RGBELoader';
import { XRControllerModelFactory } from 'XRControllerModelFactory';
import { GUI } from 'GUI';
import { InteractiveGroup } from 'InteractiveGroup';
import { HTMLMesh } from 'HTMLMesh';

// Объявление глобальных переменных
let scene, camera, renderer, light;
let currentObject = null;
let clippingPlane;
let controller1, controller2;
let controllerGrip1, controllerGrip2

const domeParameters = {
    radius: 2.5,
    subdivisions: 2,
    polyhedronType: "icosahedron",
    clippingPlaneY: 0,
    showEdges: false
};

const animationParameters = {
    roughness: 0,
    metalness: 0.1,
    rotationSpeed: 0.01,
    opacity: 1,
    color: "#a90ee1"
};

function initDome() {
    // Создаём сцену
    scene = new THREE.Scene();

    // Загружаем HDRI текстуру
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load('./texture/1.hdr', function (texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping; // Устанавливаем тип маппинга
        scene.background = texture; // Устанавливаем как фон
        scene.environment = texture; // Используем для окружения
    });

    // Создаём камеру
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.7, 2);

    // Создаём рендерер
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.localClippingEnabled = true;
    document.body.appendChild(renderer.domElement);
    document.body.appendChild(VRButton.createButton(renderer));
    window.addEventListener( 'resize', onWindowResize );

    // Добавляем поддержку контроллеров
    const geometry = new THREE.BufferGeometry();
    geometry.setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, - 5 ) ] );

    controller1 = renderer.xr.getController( 0 );
    controller1.add( new THREE.Line( geometry ) );
    scene.add( controller1 );

    controller2 = renderer.xr.getController( 1 );
    controller2.add( new THREE.Line( geometry ) );
    scene.add( controller2 );

    const controllerModelFactory = new XRControllerModelFactory();

    const controllerGrip1 = renderer.xr.getControllerGrip( 0 );
    controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
    scene.add( controllerGrip1 );

    const controllerGrip2 = renderer.xr.getControllerGrip( 1 );
    controllerGrip2.add( controllerModelFactory.createControllerModel( controllerGrip2 ) );
    scene.add( controllerGrip2 );

    // Добавляем источник света
    light = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(light);

    // Создаём GUI
    createGUI();

    // Создаём и добавляем начальный объект купола
    updateDome();

    // Запускаем анимацию
    animate();
}

function createGeodesicDome() {
    let geometry;

    if (domeParameters.polyhedronType === "icosahedron") {
        geometry = new THREE.IcosahedronGeometry(domeParameters.radius, domeParameters.subdivisions);
    } else {
        geometry = new THREE.OctahedronGeometry(domeParameters.radius, domeParameters.subdivisions);
    }

    // Создаём или обновляем плоскость отсечения
    if (!clippingPlane) {
        clippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), domeParameters.clippingPlaneY);
    } else {
        clippingPlane.constant = domeParameters.clippingPlaneY;
    }
    const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(animationParameters.color),     
        roughness: animationParameters.roughness,
        metalness: animationParameters.metalness,
        opacity: animationParameters.opacity,
        side: THREE.DoubleSide,
        wireframe: domeParameters.showEdges,
        clippingPlanes: [clippingPlane],
        transparent: true,
        clipShadows: true,
    });

    if (!domeParameters.showEdges) {
        material.flatShading = true;
    }

    const dome = new THREE.Mesh(geometry, material);
    dome.position.z = -5;
    return dome;
}

function createGUI() {
    const gui = new GUI({ width: 400, title: 'Dome Params' });
    gui.domElement.style.visibility = 'hidden';

    // Добавляем контролы
    const controllers = [
        gui.add(domeParameters, 'radius', 0.1, 5, 0.1).name('Radius').onChange(updateDome),
        gui.add(domeParameters, 'subdivisions', 0, 30, 1).name('Subdivisions').onChange(updateDome),
        gui.add(domeParameters, 'clippingPlaneY', -5, 5, 0.1).name('Clipping Plane').onChange(updateDome)
    ];
    
    const toggleTypeController = gui.add({ 
        toggleType: () => {
            domeParameters.polyhedronType = domeParameters.polyhedronType === "icosahedron" 
                ? "octahedron" 
                : "icosahedron";
            toggleTypeController.name(`${domeParameters.polyhedronType}`);
            updateDome();
        }
    }, 'toggleType').name(`${domeParameters.polyhedronType}`);
    
    const toggleWireframeController = gui.add({
        toggleWireframe: () => {
            domeParameters.showEdges = !domeParameters.showEdges;
            toggleWireframeController.name(`wireframe (${domeParameters.showEdges ? 'ON' : 'OFF'})`);
            updateDome();
        }
    }, 'toggleWireframe').name(`wireframe (${domeParameters.showEdges ? 'ON' : 'OFF'})`);
    
    controllers.push(toggleTypeController, toggleWireframeController);
    
    // Создаём вторую панель GUI для анимации
    const animationGui = new GUI({ width: 400, title: 'Dome Animation' });
    animationGui.domElement.style.visibility = 'hidden';
    
    animationGui.add(animationParameters, 'rotationSpeed', 0, 1, 0.01).name('Rotation Speed');
    animationGui.add(animationParameters, 'roughness', 0, 1, 0.01).name('Roughness').onChange(updateDome);
    animationGui.add(animationParameters, 'metalness', 0, 1, 0.01).name('Metalness').onChange(updateDome);
    animationGui.add(animationParameters, 'opacity', 0, 1, 0.01).name('Opacity').onChange(updateDome);
    animationGui.addColor(animationParameters, 'color').name('Dome Color').onChange(updateDome);
    
    // Создаём интерактивную группу для GUI в VR
    const group = new InteractiveGroup();
    group.listenToPointerEvents(renderer, camera);
    group.listenToXRControllerEvents( controller1 );
    group.listenToXRControllerEvents( controller2 );
    scene.add(group);

    // Преобразуем GUI в 3D объект с увеличенным масштабом
    const guiMesh = new HTMLMesh(gui.domElement);
    guiMesh.scale.setScalar(8);
    guiMesh.material.transparent = true;  // Включаем прозрачность
    guiMesh.material.opacity = 0.7;      // Устанавливаем уровень прозрачности
    guiMesh.visible = false;
    guiMesh.raycast = () => {}; // Полностью убираем из обработки событий
    group.add(guiMesh);

    const animationGuiMesh = new HTMLMesh(animationGui.domElement);
    animationGuiMesh.scale.setScalar(8);
    animationGuiMesh.material.transparent = true;  // Включаем прозрачность
    animationGuiMesh.material.opacity = 0.7;      // Устанавливаем уровень прозрачности
    animationGuiMesh.visible = false;
    animationGuiMesh.raycast = () => {};
    group.add(animationGuiMesh);

    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0);
    const material = new THREE.MeshBasicMaterial({ 
            color: 0x3366ff,
            transparent: true,
            opacity: 0.6
        });
            
    const button = new THREE.Mesh(geometry, material);
    button.userData.isInteractive = true;
    button.addEventListener('click', () => {
        const showUI = !guiMesh.visible;
        guiMesh.visible = showUI;
        animationGuiMesh.visible = showUI;
        material.color.setHex(showUI ? 0x33ff33 : 0x3366ff);
        
        if (showUI) {
            guiMesh.material.map.needsUpdate = true;
            animationGuiMesh.material.map.needsUpdate = true;
            guiMesh.raycast = THREE.Mesh.prototype.raycast;
            animationGuiMesh.raycast = THREE.Mesh.prototype.raycast;
        }
        if (!showUI) {
            guiMesh.raycast = () => {};
            animationGuiMesh.raycast = () => {};
        }
    });
    group.add(button);


    // Сохраняем ссылки для обновления текстур
    window.guiMesh = guiMesh;
    window.animationGuiMesh = animationGuiMesh;
    window.button = button;
}

function updateDome() {
    if (currentObject) {
        scene.remove(currentObject);
        currentObject.geometry.dispose();
        currentObject.material.dispose();
    }
    currentObject = createGeodesicDome();
    scene.add(currentObject);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}

function updateGuiPositionAndOrientation(isPresenting) {
    if (window.guiMesh || window.animationGuiMesh) {
        // Базовые смещения для GUI
        const mainGuiOffset = isPresenting ? new THREE.Vector3(-1.7, 0, -2) : new THREE.Vector3(-1.7, 0, -3);
        const secondaryGuiOffset = isPresenting ? new THREE.Vector3(1.7, 0, -2) : new THREE.Vector3(1.7, 0, -3);
        const threeGuiOffset = isPresenting ? new THREE.Vector3(2.6, 1.2, -2) : new THREE.Vector3(2.6, 1.2, -3);

        // Применяем поворот камеры к смещениям
        mainGuiOffset.applyQuaternion(camera.quaternion);
        secondaryGuiOffset.applyQuaternion(camera.quaternion);
        threeGuiOffset.applyQuaternion(camera.quaternion);

        // Устанавливаем позиции для каждого GUI
        window.guiMesh.position.copy(camera.position).add(mainGuiOffset);
        window.animationGuiMesh.position.copy(camera.position).add(secondaryGuiOffset);
        window.button.position.copy(camera.position).add(threeGuiOffset);

        // Ориентируем GUI на камеру
        window.guiMesh.quaternion.copy(camera.quaternion);
        window.animationGuiMesh.quaternion.copy(camera.quaternion);
        window.button.quaternion.copy(camera.quaternion);

        // Обновляем текстуры
        window.guiMesh.material.map.needsUpdate = true;
        window.animationGuiMesh.material.map.needsUpdate = true;
    }
}

function animate() {
    renderer.setAnimationLoop(() => {
        if (currentObject) {
            currentObject.rotation.y += animationParameters.rotationSpeed * 0.01;
        }
        if (renderer.xr.isPresenting) {
            // Обновляем позицию GUI, если XR активен
            updateGuiPositionAndOrientation(true);
        } else {
            // Обновляем позицию GUI, если XR не активен
            updateGuiPositionAndOrientation(false);
        }
        renderer.render(scene, camera);
    });
}

// Экспорт функции инициализации
export { initDome };
