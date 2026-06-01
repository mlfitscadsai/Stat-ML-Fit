import { beforeEach, describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import UploadComponent from '../../src/components/upload-component.vue';
import { createTestingPinia } from '@pinia/testing';
import Buefy from 'buefy';

describe('UploadComponent.vue', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
        });
    });

    it('renders the upload button', () => {
        const wrapper = mount(UploadComponent, {
            global: {
                plugins: [
                    createTestingPinia({ createSpy: vi.fn }),
                    Buefy
                ]
            }
        });
        
        expect(wrapper.find('.file-label').exists()).toBe(true);
        expect(wrapper.text()).toContain('Header');
    });

    it('has data properties correctly initialized', () => {
        const wrapper = mount(UploadComponent, {
            global: {
                plugins: [createTestingPinia({ createSpy: vi.fn }), Buefy]
            }
        });
        expect(wrapper.vm.separator).toBe(2);
        expect(wrapper.vm.header).toBe(true);
        expect(wrapper.vm.decimal).toBe(1);
    });

    it('only accepts parser-supported upload formats', () => {
        const wrapper = mount(UploadComponent, {
            global: {
                plugins: [createTestingPinia({ createSpy: vi.fn }), Buefy]
            }
        });

        expect(wrapper.find('input[type="file"]').attributes('accept')).toBe('.csv,.txt');
    });
});
