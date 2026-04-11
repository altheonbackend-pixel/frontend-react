import { useNavigate } from 'react-router-dom';
import PatientForm from './PatientForm';

interface AddPatientProps {
    onPatientAdded: () => void;
}

const AddPatient = ({ onPatientAdded }: AddPatientProps) => {
    const navigate = useNavigate();
    const handleClose = () => navigate('/patients');

    return <PatientForm onSuccess={onPatientAdded} onCancel={handleClose} />;
};

export default AddPatient;
