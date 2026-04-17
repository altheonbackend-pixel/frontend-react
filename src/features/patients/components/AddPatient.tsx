import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import PatientForm from './PatientForm';
import type { Patient } from '../../../shared/types';

const AddPatient = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const handleSuccess = (_patient: Patient) => {
        queryClient.invalidateQueries({ queryKey: ['patients'] });
        navigate('/patients');
    };

    return <PatientForm onSuccess={handleSuccess} onCancel={() => navigate('/patients')} />;
};

export default AddPatient;
