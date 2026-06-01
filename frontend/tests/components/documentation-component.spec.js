import { beforeEach, describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DocumentationComponent from '../../src/components/tabs/documentation-component.vue';
import { createTestingPinia } from '@pinia/testing';
import Buefy from 'buefy';

// Mock Three.js to prevent JSDOM WebGL rendering errors
vi.mock('three', () => {
    function MockVector3(x = 0, y = 0, z = 0) {
        this.x = x; this.y = y; this.z = z;
    }
    MockVector3.prototype.set = function(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; return this; };
    MockVector3.prototype.clone = function() { return new MockVector3(this.x, this.y, this.z); };
    MockVector3.prototype.add = function(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; };
    MockVector3.prototype.multiplyScalar = function(s) { this.x *= s; this.y *= s; this.z *= s; return this; };
    MockVector3.prototype.distanceTo = function() { return 1.5; };
    MockVector3.prototype.copy = function(v) {
        this.x = v.x; this.y = v.y; this.z = v.z;
        return this;
    };
    MockVector3.prototype.lerp = function() { return this; };
    MockVector3.prototype.project = function() {};

    function MockScene() { this.add = vi.fn(); this.remove = vi.fn(); this.traverse = vi.fn(); }
    function MockCamera() { this.position = new MockVector3(); this.lookAt = vi.fn(); this.updateProjectionMatrix = vi.fn(); }
    function MockRenderer() {
        this.setSize = vi.fn();
        this.setPixelRatio = vi.fn();
        this.shadowMap = {};
        this.domElement = document.createElement('canvas');
        this.render = vi.fn();
        this.dispose = vi.fn();
    }
    function MockLight() { this.position = new MockVector3(); }
    function MockGroup() {
        this.position = new MockVector3();
        this.rotation = new MockVector3();
        this.add = vi.fn();
        this.remove = vi.fn();
        this.lookAt = vi.fn();
        this.rotateX = vi.fn();
        this.rotateY = vi.fn();
        this.rotateZ = vi.fn();
    }
    function MockGeometry() {
        this.rotateX = vi.fn(); this.rotateY = vi.fn(); this.rotateZ = vi.fn();
        this.computeVertexNormals = vi.fn();
        this.setAttribute = vi.fn();
        this.setIndex = vi.fn();
        this.attributes = {
            position: {
                getX: vi.fn(() => 0), getZ: vi.fn(() => 0), getY: vi.fn(() => 0),
                setY: vi.fn(), needsUpdate: false, count: 10
            },
            color: { needsUpdate: false }
        };
    }
    function MockMesh(geometry, material) {
        this.geometry = geometry || new MockGeometry();
        this.material = material;
        this.position = new MockVector3();
        this.scale = { setScalar: vi.fn(), set: vi.fn() };
        this.rotation = new MockVector3();
        this.lookAt = vi.fn();
        this.add = vi.fn();
        this.remove = vi.fn();
        this.rotateX = vi.fn();
        this.rotateY = vi.fn();
        this.rotateZ = vi.fn();
    }
    function MockLine(geometry, material) {
        this.geometry = geometry || new MockGeometry();
        this.material = material;
        this.position = new MockVector3();
        this.rotation = new MockVector3();
        this.lookAt = vi.fn();
        this.rotateX = vi.fn();
        this.rotateY = vi.fn();
        this.rotateZ = vi.fn();
    }
    function MockColor() {
        this.r = 0.5; this.g = 0.5; this.b = 0.5;
    }
    MockColor.prototype.lerpColors = function(c1, c2, t) {
        this.r = c1.r + (c2.r - c1.r) * t;
        this.g = c1.g + (c2.g - c1.g) * t;
        this.b = c1.b + (c2.b - c1.b) * t;
        return this;
    };
    MockColor.prototype.set = function() { return this; };

    return {
        Scene: vi.fn().mockImplementation(function() { return new MockScene(); }),
        PerspectiveCamera: vi.fn().mockImplementation(function() { return new MockCamera(); }),
        WebGLRenderer: vi.fn().mockImplementation(function() { return new MockRenderer(); }),
        AmbientLight: vi.fn().mockImplementation(function() { return new MockLight(); }),
        DirectionalLight: vi.fn().mockImplementation(function() { return new MockLight(); }),
        GridHelper: vi.fn().mockImplementation(function() { return new MockMesh(); }),
        Group: vi.fn().mockImplementation(function() { return new MockGroup(); }),
        Vector3: vi.fn().mockImplementation(function(x, y, z) { return new MockVector3(x, y, z); }),
        Color: vi.fn().mockImplementation(function() { return new MockColor(); }),
        FogExp2: vi.fn().mockImplementation(function() { return {}; }),
        SphereGeometry: vi.fn().mockImplementation(function() { return new MockGeometry(); }),
        MeshPhongMaterial: vi.fn().mockImplementation(function() { return {}; }),
        MeshBasicMaterial: vi.fn().mockImplementation(function() { return {}; }),
        Mesh: vi.fn().mockImplementation(function(geom, mat) { return new MockMesh(geom, mat); }),
        PlaneGeometry: vi.fn().mockImplementation(function() { return new MockGeometry(); }),
        RingGeometry: vi.fn().mockImplementation(function() { return new MockGeometry(); }),
        CylinderGeometry: vi.fn().mockImplementation(function() { return new MockGeometry(); }),
        BoxGeometry: vi.fn().mockImplementation(function() { return new MockGeometry(); }),
        OctahedronGeometry: vi.fn().mockImplementation(function() { return new MockGeometry(); }),
        LineBasicMaterial: vi.fn().mockImplementation(function() { return {}; }),
        LineSegments: vi.fn().mockImplementation(function(geom, mat) { return new MockLine(geom, mat); }),
        BufferGeometry: vi.fn().mockImplementation(function() { return new MockGeometry(); }),
        Float32BufferAttribute: vi.fn().mockImplementation(function() { return {}; }),
        DoubleSide: 2
    };
});

describe('DocumentationComponent.vue 3D Redesign', () => {
    let mockStorage = {};

    beforeEach(() => {
        mockStorage = {};
        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key) => mockStorage[key] || null),
            setItem: vi.fn((key, value) => { mockStorage[key] = value.toString(); }),
        });
    });

    it('renders the 3D Spatial Lab by default', () => {
        const wrapper = mount(DocumentationComponent, {
            global: {
                plugins: [
                    createTestingPinia({ createSpy: vi.fn }),
                    Buefy
                ]
            }
        });
        
        expect(wrapper.vm.viewMode).toBe('3d');
        expect(wrapper.find('.lab-container').exists()).toBe(true);
        expect(wrapper.find('.lab-sidebar').exists()).toBe(true);
        expect(wrapper.find('.lab-viewport-container').exists()).toBe(true);
        expect(wrapper.find('.lab-hud-panel').exists()).toBe(true);
    });

    it('toggles view mode from 3D to 2D classic view', async () => {
        const wrapper = mount(DocumentationComponent, {
            global: {
                plugins: [
                    createTestingPinia({ createSpy: vi.fn }),
                    Buefy
                ]
            }
        });

        const toggle2DButton = wrapper.findAll('.toggle-btn').find(b => b.text().includes('Classic 2D View'));
        expect(toggle2DButton.exists()).toBe(true);
        
        await toggle2DButton.trigger('click');
        expect(wrapper.vm.viewMode).toBe('2d');
        expect(wrapper.find('.classic-view-container').exists()).toBe(true);
        expect(wrapper.find('.lab-container').exists()).toBe(false);
    });

    it('allows searching methods in the 3D sidebar', async () => {
        const wrapper = mount(DocumentationComponent, {
            global: {
                plugins: [
                    createTestingPinia({ createSpy: vi.fn }),
                    Buefy
                ]
            }
        });

        expect(wrapper.findAll('.sidebar-item').length).toBe(12);
        
        await wrapper.find('.sidebar-search input').setValue('SVM');
        expect(wrapper.vm.searchQuery).toBe('SVM');
        
        expect(wrapper.findAll('.sidebar-item').length).toBe(1);
        expect(wrapper.find('.sidebar-item__name').text()).toContain('Support Vector Machine');
    });

    it('saves completed/mastered concepts in local storage', async () => {
        const wrapper = mount(DocumentationComponent, {
            global: {
                plugins: [
                    createTestingPinia({ createSpy: vi.fn }),
                    Buefy
                ]
            }
        });

        expect(wrapper.vm.completedAlgos).not.toContain('logistic');
        
        const markMasteredBtn = wrapper.find('.mastery-toggle-btn');
        await markMasteredBtn.trigger('click');
        
        expect(wrapper.vm.completedAlgos).toContain('logistic');
        expect(mockStorage['stat_ml_fit_completed_algos']).toContain('logistic');
    });
});
