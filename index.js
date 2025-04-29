import * as THREE from 'three';
import { VRButton } from 'VRButton';
import { RGBELoader } from 'RGBELoader';
import { XRControllerModelFactory } from 'XRControllerModelFactory';
import { GUI } from 'GUI';
import { InteractiveGroup } from 'InteractiveGroup';
import { HTMLMesh } from 'HTMLMesh';
import { OBJLoader } from 'OBJLoader'; // Добавляем OBJLoader
import { createText } from 'CreateText';

// Объявление глобальных переменных
let scene, camera, renderer, light;
let currentObject = null;
let clippingPlane;
let controller1, controller2;
let isUsingObjModel = false;
// Параметры для позиционирования модели
const modelParameters = {
    positionX: 0,
    positionY: 0,
    positionZ: -2,  // Значение по умолчанию -5
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scale: 2
};

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

const textures = [
    './texture/1.hdr',
    './texture/2.hdr', 
    './texture/3.hdr',
    './texture/4.hdr', 
    './texture/5.hdr'
];
let currentTextureIndex = 0;
let currentBackgroundTexture = null;

function initDome() {
    // Создаём сцену
    scene = new THREE.Scene();

    // Загружаем HDRI текстуру
    loadTexture(0);

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

function loadTexture(index) {
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load(textures[index], function(texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        
        // Удаляем предыдущую текстуру, если она есть
        if (currentBackgroundTexture) {
            currentBackgroundTexture.dispose();
        }
        
        scene.background = texture;
        scene.environment = texture;
        currentBackgroundTexture = texture;
        currentTextureIndex = index;
    });
}

function loadOBJModel(file) {
    const objLoader = new OBJLoader();
    const reader = new FileReader();

    reader.onload = function(event) {
        const contents = event.target.result;
        const object = objLoader.parse(contents);
        
        // Удаляем предыдущий объект, если он есть
        if (currentObject) {
            scene.remove(currentObject);
            if (currentObject.geometry) currentObject.geometry.dispose();
            if (currentObject.material) {
                if (Array.isArray(currentObject.material)) {
                    currentObject.material.forEach(m => m.dispose());
                } else {
                    currentObject.material.dispose();
                }
            }
        }
        
        // 1. Сначала получаем bounding box
        const box = new THREE.Box3().setFromObject(object);
        
        // 2. Затем вычисляем центр
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3()).length();
        
        // 3. Сохраняем параметры до трансформаций
        const originalCenter = center.clone();
        const initialScale = size > 2 ? 2 / size : 1;
        
        // 4. Центрируем модель
        object.position.sub(center);
        
        // 5. Размещаем перед камерой
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        const basePosition = camera.position.clone().add(cameraDirection.multiplyScalar(3));
        object.position.copy(basePosition);
        
        // 6. Масштабируем при необходимости
        if (size > 2) {
            object.scale.setScalar(initialScale);
        }
        
        // 7. Сохраняем все начальные параметры
        object.userData = {
            originalCenter: originalCenter,
            initialScale: initialScale,
            basePosition: basePosition,
            initialRotation: new THREE.Euler(0, 0, 0)
        };
        
        isUsingObjModel = true;
        currentObject = object;
        scene.add(currentObject);
        
        updateModelPosition();
        updateMaterial(currentObject);
    };

    reader.readAsText(file);
}

function updateMaterial(object) {
    if (!object) return;
    
    // Сохраняем текущие трансформации
    const position = object.position.clone();
    const rotation = object.rotation.clone();
    const scale = object.scale.clone();
    
    object.traverse(function(child) {
        if (child.isMesh) {
            child.material = new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(animationParameters.color),
                roughness: animationParameters.roughness,
                metalness: animationParameters.metalness,
                opacity: animationParameters.opacity,
                side: THREE.DoubleSide,
                wireframe: domeParameters.showEdges,
                clippingPlanes: [clippingPlane],
                transparent: true,
                clipShadows: true,
                flatShading: !domeParameters.showEdges
            });
        }
    });
    // Восстанавливаем трансформации
    object.position.copy(position);
    object.rotation.copy(rotation);
    object.scale.copy(scale);
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


    // Создаём третью панель GUI для позиционирования
    const modelGui = new GUI({ width: 400, title: 'Dome Animation' });
    modelGui.domElement.style.visibility = 'hidden';
    
    const controllersObj = [
        modelGui.add(modelParameters, 'positionX', -5, 5, 0.1).name('Position X').onChange(updateModelPosition),
        modelGui.add(modelParameters, 'positionY', -5, 5, 0.1).name('Position Y').onChange(updateModelPosition),
        modelGui.add(modelParameters, 'positionZ', -5, 5, 0.1).name('Position Z').onChange(updateModelPosition),
        modelGui.add(modelParameters, 'rotationX', 0, Math.PI * 2, 0.01).name('Rotation X').onChange(updateModelPosition),
        modelGui.add(modelParameters, 'rotationY', 0, Math.PI * 2, 0.01).name('Rotation Y').onChange(updateModelPosition),
        modelGui.add(modelParameters, 'rotationZ', 0, Math.PI * 2, 0.01).name('Rotation Z').onChange(updateModelPosition),
        modelGui.add(modelParameters, 'scale', 0.1, 5, 0.1).name('Scale').onChange(updateModelPosition)
    ];

    const toggleWireframeControllerObj = modelGui.add({
        toggleWireframe: () => {
            domeParameters.showEdges = !domeParameters.showEdges;
            toggleWireframeController.name(`wireframe (${domeParameters.showEdges ? 'ON' : 'OFF'})`);
            updateDome();
        }
    }, 'toggleWireframe').name(`wireframe (${domeParameters.showEdges ? 'ON' : 'OFF'})`);
    controllersObj.push(toggleWireframeControllerObj);

    // Создаём интерактивную группу для GUI в VR
    const group = new InteractiveGroup();
    group.listenToPointerEvents(renderer, camera);
    group.listenToXRControllerEvents( controller1 );
    group.listenToXRControllerEvents( controller2 );
    scene.add(group);

    // Создаем соответствующую HTMLMesh в зависимости от режима
    const guiMesh = new HTMLMesh(gui.domElement); // Для купола по умолчанию
    guiMesh.scale.setScalar(8);
    guiMesh.material.transparent = true;  // Включаем прозрачность
    guiMesh.material.opacity = 0.7;      // Устанавливаем уровень прозрачности
    guiMesh.visible = false;
    guiMesh.raycast = () => {}; // Полностью убираем из обработки событий
    group.add(guiMesh);

    const guimodelMesh = new HTMLMesh(modelGui.domElement); // Для купола по умолчанию
    guimodelMesh.scale.setScalar(8);
    guimodelMesh.material.transparent = true;  // Включаем прозрачность
    guimodelMesh.material.opacity = 0.7;      // Устанавливаем уровень прозрачности
    guimodelMesh.visible = false;
    guimodelMesh.raycast = () => {}; // Полностью убираем из обработки событий
    group.add(guimodelMesh);

    const animationGuiMesh = new HTMLMesh(animationGui.domElement);
    animationGuiMesh.scale.setScalar(8);
    animationGuiMesh.material.transparent = true;  // Включаем прозрачность
    animationGuiMesh.material.opacity = 0.7;      // Устанавливаем уровень прозрачности
    animationGuiMesh.visible = false;
    animationGuiMesh.raycast = () => {};
    group.add(animationGuiMesh);

   // Создаём кнопку для загрузки модели
   const loadButtonGeometry = new THREE.BoxGeometry(0.5, 0.5, 0);
   const loadButtonMaterial = new THREE.MeshBasicMaterial({ 
       color: 0xff9933,
       transparent: true,
       opacity: 0.6
   });
           
   const loadButton = new THREE.Mesh(loadButtonGeometry, loadButtonMaterial);
   loadButton.userData.isInteractive = true;
   const loadButtonText = createText( 'load OBJ', 0.06 );
   loadButton.add( loadButtonText );
   loadButton.addEventListener('click', () => {
       // Создаём скрытый input элемент для выбора файла
       const input = document.createElement('input');
       input.type = 'file';
       input.accept = '.obj';
       input.onchange = e => {
           const file = e.target.files[0];
           if (file) {
               loadOBJModel(file);
           }
       };
       input.click();
   });
   group.add(loadButton);

// Создаём кнопку для показа панелей управления
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0);
    const material = new THREE.MeshBasicMaterial({ 
            color: 0x3366ff,
            transparent: true,
            opacity: 0.6
        });
            
    const button = new THREE.Mesh(geometry, material);
    button.userData.isInteractive = true;
    const buttonText = createText( 'setting', 0.06 );
    button.add( buttonText );
    button.addEventListener('click', () => {
        const showUI = !animationGuiMesh.visible;
        guiMesh.visible = showUI;
        guimodelMesh.visible = showUI;
        animationGuiMesh.visible = showUI;
        material.color.setHex(showUI ? 0x33ff33 : 0x3366ff);
        
        if (showUI) {
            guiMesh.material.map.needsUpdate = true;
            guimodelMesh.material.map.needsUpdate = true;
            animationGuiMesh.material.map.needsUpdate = true;
            guiMesh.raycast = THREE.Mesh.prototype.raycast;
            guimodelMesh.raycast = THREE.Mesh.prototype.raycast;
            animationGuiMesh.raycast = THREE.Mesh.prototype.raycast;
        }
        if (!showUI) {
            guiMesh.raycast = () => {};
            guimodelMesh.raycast = () => {};
            animationGuiMesh.raycast = () => {};
        }
    });
    group.add(button);

    // Создаём кнопку сброса к куполу
    const resetButtonGeometry = new THREE.BoxGeometry(0.5, 0.5, 0);
    const resetButtonMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff3333,
        transparent: true,
        opacity: 0.6
    });
    const resetButton = new THREE.Mesh(resetButtonGeometry, resetButtonMaterial);
    resetButton.userData.isInteractive = true;
    const resetButtonText = createText( 'reset model', 0.06 );
    resetButton.add( resetButtonText );
    resetButton.addEventListener('click', () => {
        isUsingObjModel = false;
        updateDome();
    });
    group.add(resetButton);

    // Создаём кнопку изменения текстуры
    const textureButtonGeometry = new THREE.BoxGeometry(0.5, 0.5, 0);
    const textureButtonMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00,
        transparent: true,
        opacity: 0.6
    });
    const textureButton = new THREE.Mesh(textureButtonGeometry, textureButtonMaterial);
    textureButton.position.set(3.2, 0.6, -3);
    textureButton.userData.isInteractive = true;
    const textureButtonText = createText('change texture', 0.06);
    textureButton.add(textureButtonText);
    textureButton.addEventListener('click', () => {
        currentTextureIndex = (currentTextureIndex + 1) % textures.length;
        loadTexture(currentTextureIndex);
    });
    group.add(textureButton);


    // Сохраняем ссылки для обновления текстур
    window.guiMesh = guiMesh;
    window.animationGuiMesh = animationGuiMesh;
    window.button = button;
    window.loadButton = loadButton;
    window.resetButton = resetButton;
    window.guimodelMesh = guimodelMesh;
    window.modelParameters = modelParameters;
    window.textureButton = textureButton;
}

function updateModelPosition() {
    if (!isUsingObjModel || !currentObject || !currentObject.userData) return;

    // Базовые параметры из начального позиционирования
    const { originalCenter, initialScale, basePosition } = currentObject.userData;
    
    // Применяем смещение относительно начальной позиции
    currentObject.position.copy(basePosition)
        .add(new THREE.Vector3(
            modelParameters.positionX,
            modelParameters.positionY,
            modelParameters.positionZ
        ));
    
    // Применяем поворот
    currentObject.rotation.set(
        modelParameters.rotationX,
        modelParameters.rotationY,
        modelParameters.rotationZ
    );
    
    // Применяем масштаб с учетом начального
    currentObject.scale.setScalar(initialScale * modelParameters.scale);
}

function updateDome() {
    // Если у нас загружена OBJ-модель, не создаем купол по умолчанию
    if (isUsingObjModel) {
        // Просто обновляем материал существующей модели
        if (currentObject) {
            updateMaterial(currentObject);
        }
        return;
    }

    // Удаляем предыдущий объект (если есть) с очисткой памяти
    if (currentObject) {
        scene.remove(currentObject);
        
        // Очищаем геометрию
        if (currentObject.geometry) {
            currentObject.geometry.dispose();
        }
        
        // Очищаем материалы (учитываем как массивы, так и одиночные материалы)
        if (currentObject.material) {
            if (Array.isArray(currentObject.material)) {
                currentObject.material.forEach(m => m.dispose());
            } else {
                currentObject.material.dispose();
            }
        }
        
        // Очищаем дочерние элементы, если это группа объектов
        if (currentObject.children) {
            currentObject.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
    }

    // Создаем новый геодезический купол только если не используется OBJ-модель
    if (!isUsingObjModel) {
        currentObject = createGeodesicDome();
        
        // Настраиваем положение купола
        currentObject.position.set(0, 0, -5);
        
        // Добавляем купол на сцену
        scene.add(currentObject);
        
        // Обновляем материал с текущими параметрами
        updateMaterial(currentObject);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}

function updateGuiPositionAndOrientation(isPresenting) {
    if (window.guiMesh || window.animationGuiMesh) {



        if(!isUsingObjModel){
            const mainGuiOffset = isPresenting ? new THREE.Vector3(-1.7, 0, -2) : new THREE.Vector3(-1.7, 0, -3);
            mainGuiOffset.applyQuaternion(camera.quaternion);
            window.guiMesh.position.copy(camera.position).add(mainGuiOffset);
            window.guiMesh.quaternion.copy(camera.quaternion);
            window.guiMesh.material.map.needsUpdate = true;

            const sixGuiOffset = isPresenting ? new THREE.Vector3(-1.7, -100.5, -2) : new THREE.Vector3(-1.7, -100.5, -3);
            sixGuiOffset.applyQuaternion(camera.quaternion);
            window.guimodelMesh.position.copy(camera.position).add(sixGuiOffset);
            window.guimodelMesh.quaternion.copy(camera.quaternion);
            window.guimodelMesh.material.map.needsUpdate = true;
        }else{
            const mainGuiOffset = isPresenting ? new THREE.Vector3(-1.7, 100.2, -2) : new THREE.Vector3(-1.7, 100.2, -3);
            mainGuiOffset.applyQuaternion(camera.quaternion);
            window.guiMesh.position.copy(camera.position).add(mainGuiOffset);
            window.guiMesh.quaternion.copy(camera.quaternion);
            window.guiMesh.material.map.needsUpdate = true;

            const sixGuiOffset = isPresenting ? new THREE.Vector3(-1.7, 0, -2) : new THREE.Vector3(-1.7, 0, -3);
            sixGuiOffset.applyQuaternion(camera.quaternion);
            window.guimodelMesh.position.copy(camera.position).add(sixGuiOffset);
            window.guimodelMesh.quaternion.copy(camera.quaternion);
            window.guimodelMesh.material.map.needsUpdate = true;
        }

        const secondaryGuiOffset = isPresenting ? new THREE.Vector3(1.7, 0, -2) : new THREE.Vector3(1.7, 0, -3);    // Базовые смещения для GUI
        secondaryGuiOffset.applyQuaternion(camera.quaternion);                                                      // Применяем поворот камеры к смещениям
        window.animationGuiMesh.position.copy(camera.position).add(secondaryGuiOffset);                             // Устанавливаем позиции для каждого GUI
        window.animationGuiMesh.quaternion.copy(camera.quaternion);                                                 // Ориентируем GUI на камеру
        window.animationGuiMesh.material.map.needsUpdate = true;                                                    // Обновляем текстуры

        const threeGuiOffset = isPresenting ? new THREE.Vector3(2.6, 1.2, -2) : new THREE.Vector3(2.6, 1.2, -3);
        threeGuiOffset.applyQuaternion(camera.quaternion);
        window.button.position.copy(camera.position).add(threeGuiOffset);
        window.button.quaternion.copy(camera.quaternion);

        const fourGuiOffset = isPresenting ? new THREE.Vector3(2, 1.2, -2) : new THREE.Vector3(2, 1.2, -3);
        fourGuiOffset.applyQuaternion(camera.quaternion);
        window.loadButton.position.copy(camera.position).add(fourGuiOffset);
        window.loadButton.quaternion.copy(camera.quaternion);

        const fiveGuiOffset = isPresenting ? new THREE.Vector3(1.4, 1.2, -2) : new THREE.Vector3(1.4, 1.2, -3);
        fiveGuiOffset.applyQuaternion(camera.quaternion);
        window.resetButton.position.copy(camera.position).add(fiveGuiOffset);
        window.resetButton.quaternion.copy(camera.quaternion);

        const textureButtonOffset = isPresenting ? new THREE.Vector3(0.8, 1.2, -2) : new THREE.Vector3(0.8, 1.2, -3);
        textureButtonOffset.applyQuaternion(camera.quaternion);
        window.textureButton.position.copy(camera.position).add(textureButtonOffset);
        window.textureButton.quaternion.copy(camera.quaternion);

        
        
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
