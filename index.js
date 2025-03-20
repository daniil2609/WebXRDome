// http-server .
// Импорт библиотек и модулей
//import * as THREE from './node_modules/three/build/three.module.js'; // Основная библиотека Three.js для работы с 3D
//import { VRButton } from './node_modules/three/examples/jsm/webxr/VRButton.js'; // Модуль для добавления VR-функционала
//import { RGBELoader } from './node_modules/three/examples/jsm/loaders/RGBELoader.js'

import * as THREE from 'three';
import { VRButton } from 'VRButton';
import { RGBELoader } from 'RGBELoader';


// Объявление глобальных переменных
let scene, camera, renderer, light; // Основные компоненты Three.js
let currentObject = null; // Переменная для хранения текущего объекта купола
let radius = 1.5; //радиус
let subdivisions = 2;  //детализация
let polyhedronType = "icosahedron"; // тип купола
let clippingPlane; // Переменная для хранения плоскости отсечения
let clippingPlaneY = 0; // Положение плоскости отсечения по умолчанию
let showEdges = false; //Отображение только граней

/**
 * Инициализация сцены, камеры, рендерера и VR-функционала.
 */
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

    // Создаём камеру с перспективной проекцией
    camera = new THREE.PerspectiveCamera(
        60, // Угол обзора
        window.innerWidth / window.innerHeight, // Соотношение сторон
        0.1, // Ближняя плоскость отсечения
        100 // Дальняя плоскость отсечения
    );

    // Создаём WebGLRenderer для отрисовки сцены
    renderer = new THREE.WebGLRenderer({ antialias: true }); // Включаем сглаживание
    renderer.setSize(window.innerWidth, window.innerHeight); // Устанавливаем размер рендерера
    renderer.xr.enabled = true; // Включаем поддержку VR
    renderer.localClippingEnabled = true; // Включает обработку отсечения сферы
    document.body.appendChild(renderer.domElement); // Добавляем канвас рендерера в DOM
    document.body.appendChild(VRButton.createButton(renderer)); // Добавляем кнопку "Enter VR" для включения VR-режима

    // Добавляем источник света
    light = new THREE.HemisphereLight(0xffffff, 0x444444, 1); // Полусферический свет
    scene.add(light);

    // Устанавливаем позицию камеры
    camera.position.y = 1.7; // Отодвигаем камеру назад, чтобы видеть сцену
    camera.position.z = 2; // Отодвигаем камеру назад, чтобы видеть сцену

    // Создаём и добавляем начальный объект купола
    updateDome();

    // Создаём элементы управления для VR
    createVRControls();

    // Запускаем анимацию
    animate();
}



/**
 * Создаёт геодезический купол с заданными параметрами.
 * @returns {THREE.Mesh} - Сгенерированный 3D-объект купола.
 */
function createGeodesicDome() {
    let geometry;

    // Выбор типа многогранника на основе параметра polyhedronType
    if (polyhedronType === "icosahedron") {
        geometry = new THREE.IcosahedronGeometry(radius, subdivisions);
    } else if (polyhedronType === "octahedron") {
        geometry = new THREE.OctahedronGeometry(radius, subdivisions);
    } else {
        console.error("Invalid polyhedron type");
    }

    // Создаём или обновляем плоскость отсечения
    if (!clippingPlane) {
        clippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), clippingPlaneY);
    } else {
        clippingPlane.constant = clippingPlaneY; // Обновляем положение плоскости отсечения
    }
    
    // Создаём материал с применением плоскости отсечения
    /*
    const material = new THREE.MeshStandardMaterial({
        color: 0x0077ff, // Цвет купола
        wireframe: true, // Показываем только каркас
        wireframe: showEdges,
        clippingPlanes: [clippingPlane], // Применяем плоскость отсечения
        clipShadows: true, // Обрезка теней
    });*/
    const material = new THREE.MeshPhysicalMaterial({
        transmission: 1.0, 
        roughness: 0, 
        metalness: 0.25, 
        thickness: 0.5, 
        side: THREE.DoubleSide,
        wireframe: showEdges,
        clippingPlanes: [clippingPlane], // Применяем плоскость отсечения
        clipShadows: true, // Обрезка теней
    });


    const dome = new THREE.Mesh(geometry, material);
    dome.position.z = -5; // Перемещаем купол дальше от камеры
    return dome;
}

/**
 * Создаёт элементы управления для изменения параметров купола, включая отсечение.
 */
function createVRControls() {
    // Определяем материалы для кнопок
    const buttonMaterial1 = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Красная кнопка
    const buttonMaterial2 = new THREE.MeshBasicMaterial({ color: 0x0606ff }); // Синяя кнопка
    const buttonMaterial3 = new THREE.MeshBasicMaterial({ color: 0x06ff1f }); // Зелёная кнопка

    // Геометрия кнопок
    const buttonGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.1);

    // Создаём кнопки для изменения параметров
    const increaseRadiusButton = new THREE.Mesh(buttonGeometry, buttonMaterial1);
    increaseRadiusButton.position.set(-5, 3, -5); // Устанавливаем позицию кнопки
    scene.add(increaseRadiusButton);

    const decreaseRadiusButton = new THREE.Mesh(buttonGeometry, buttonMaterial1);
    decreaseRadiusButton.position.set(-4.6, 3, -5);
    scene.add(decreaseRadiusButton);

    const increaseSubdivisionsButton = new THREE.Mesh(buttonGeometry, buttonMaterial2);
    increaseSubdivisionsButton.position.set(-4.2, 3, -5);
    scene.add(increaseSubdivisionsButton);

    const decreaseSubdivisionsButton = new THREE.Mesh(buttonGeometry, buttonMaterial2);
    decreaseSubdivisionsButton.position.set(-3.8, 3, -5);
    scene.add(decreaseSubdivisionsButton);

    const polyhedronTypeButton = new THREE.Mesh(buttonGeometry, buttonMaterial3);
    polyhedronTypeButton.position.set(-3.4, 3, -5);
    scene.add(polyhedronTypeButton);

    // Кнопка увеличения отсечения
    const increaseClippingButton = new THREE.Mesh(buttonGeometry, buttonMaterial1);
    increaseClippingButton.position.set(-3.0, 3, -5);
    scene.add(increaseClippingButton);

    // Кнопка уменьшения отсечения
    const decreaseClippingButton = new THREE.Mesh(buttonGeometry, buttonMaterial1);
    decreaseClippingButton.position.set(-2.6, 3, -5);
    scene.add(decreaseClippingButton);

    // Кнопка изменения отрисовки (только грани)
    const showEdgesButton = new THREE.Mesh(buttonGeometry, buttonMaterial3);
    showEdgesButton.position.set(-2.2, 3, -5);
    scene.add(showEdgesButton);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onPointerMove(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    function onPointerDown() {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects([
            increaseRadiusButton,
            decreaseRadiusButton,
            increaseSubdivisionsButton,
            decreaseSubdivisionsButton,
            polyhedronTypeButton,
            increaseClippingButton, 
            decreaseClippingButton,
            showEdgesButton
        ]);

        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;

            if (clickedObject === increaseClippingButton) {
                clippingPlaneY = Math.min(clippingPlaneY + 0.1, radius); // Поднимаем плоскость
            } else if (clickedObject === decreaseClippingButton) {
                clippingPlaneY = Math.max(clippingPlaneY - 0.1, -radius); // Опускаем плоскость
            }  else if (clickedObject === increaseRadiusButton) {
                radius = Math.min(radius + 0.1, 5);
            } else if (clickedObject === decreaseRadiusButton) {
                radius = Math.max(radius - 0.1, 0.1);
            } else if (clickedObject === increaseSubdivisionsButton) {
                subdivisions = Math.min(subdivisions + 1, 30);
            } else if (clickedObject === decreaseSubdivisionsButton) {
                subdivisions = Math.max(subdivisions - 1, 0);
            } else if (clickedObject === polyhedronTypeButton) {
                polyhedronType = (polyhedronType === "icosahedron") ? "octahedron" : "icosahedron";
            } else if (clickedObject === showEdgesButton) {
                showEdges = (showEdges === true) ? false : true;
            }

            updateDome(); // Обновляем купол с новыми параметрами
        }
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerdown', onPointerDown);
}

/**
 * Обновляет купол в сцене с новыми параметрами.
 */
function updateDome() {
    removeObject(currentObject); // Удаляем текущий объект
    currentObject = createGeodesicDome(); // Создаём новый объект
    scene.add(currentObject); // Добавляем объект в сцену
    console.log(currentObject);
}

/**
 * Удаляет объект из сцены и освобождает ресурсы.
 * @param {THREE.Mesh} object - Объект, который нужно удалить.
 */
function removeObject(object) {
    if (object) {
        scene.remove(object); // Удаляем объект из сцены
        object.geometry.dispose(); // Освобождаем геометрию
        object.material.dispose(); // Освобождаем материал
    }
}

/**
 * Главная функция анимации.
 */
function animate() {
    renderer.setAnimationLoop(() => {
        if (currentObject) {
            currentObject.rotation.y += 0.001; // Вращаем объект для наглядности
        }
        renderer.render(scene, camera); // Рендерим сцену
    });
}

// Экспорт функции инициализации
export { initDome };
