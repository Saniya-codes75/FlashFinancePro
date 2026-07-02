import os
import json
import calendar
from datetime import datetime, timedelta
import google.generativeai as genai

from django.contrib.auth.models import User
from django.db.models import Sum
from django.http import JsonResponse
from django.utils import timezone
from django.utils.timezone import make_aware
from django.views.decorators.csrf import csrf_exempt

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

# Consolidated imports of your local database models
from .models import Expense, MonthlyBudget, SavingsGoal, UserStreak


# =====================================================================
# 1. CORE EXPENSE OPERATIONS (AI ADD, SUMMARY WITH BUDGET, & DELETE)
# =====================================================================
import json
import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
import google.generativeai as genai
import os
from .models import Expense # Make sure this matches your model import path

class AddExpenseAI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        text = request.data.get('text') or request.data.get('prompt')
        
        if not text:
            return Response({"status": "error", "message": "No text provided"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Quick Local Rule Matching (Instant fallback before even calling AI)
        text_lower = text.lower()
        inferred_category = "Others"
        
        if any(w in text_lower for w in ["pizza", "food", "burger", "dinner", "lunch", "restaurant", "cafe", "swiggy", "zomato"]):
            inferred_category = "Food"
        elif any(w in text_lower for w in ["keyboard", "mouse", "laptop", "cable", "tech", "phone", "electronics"]):
            inferred_category = "Electronics"
        elif any(w in text_lower for w in ["shirt", "jeans", "shoes", "clothes", "shopping"]):
            inferred_category = "Shopping"
        elif any(w in text_lower for w in ["chips", "snacks", "kurkure", "lays", "biscuit"]):
            inferred_category = "Snacks"
        elif any(w in text_lower for w in ["coke", "pepsi", "juice", "drink", "water"]):
            inferred_category = "Drink"

        # Default clean fallbacks
        title = text.strip()
        amount = 0.0
        category = inferred_category

        try:
            # 2. Hardened Gemini Execution Environment
            genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            prompt_text = f"""
            You are a precise expense manager backend system.
            Extract details from this user log: "{text}"
            
            Choose the most accurate category from this exact list:
            ["Food", "Electronics", "Shopping", "Snacks", "Drink", "Others"]
            
            Return ONLY a raw, single-line JSON string. Do not include markdown tags, block expressions, or backticks.
            Example valid response structure:
            {{"title": "Pizza purchase", "amount": 300.0, "category": "Food"}}
            """
            
            response = model.generate_content(prompt_text)
            
            # Clean up potential markdown formatting wrapping errors
            clean_text = response.text.strip()
            if clean_text.startswith("```"):
                clean_text = clean_text.replace("```json", "").replace("```", "").strip()
            
            extracted_data = json.loads(clean_text)
            
            # Extract keys safely
            title = extracted_data.get('title', title)
            amount = extracted_data.get('amount', amount)
            
            # If the AI returns a category, normalize its casing
            ai_cat = extracted_data.get('category', '').strip().capitalize()
            if ai_cat in ["Food", "Electronics", "Shopping", "Snacks", "Drink", "Others"]:
                category = ai_cat

        except Exception as e:
            print(f"Gemini operational parsing failure tracking log: {e}")
            # If AI fails, use regex to pull out the digits for amount
            numbers = re.findall(r'\d+', text)
            if numbers:
                amount = float(numbers[0])

        # 3. Final Sanitization Layer before DB Write
        try:
            amount = float(amount)
        except ValueError:
            amount = 0.0
            
        title = str(title).strip()
        category = str(category).strip()

        # Save record tracking to database
        expense = Expense.objects.create(
            user=request.user, 
            title=title,
            amount=amount,
            category=category
        )

        return Response({
            "status": "success", 
            "data": {
                "title": expense.title,
                "amount": expense.amount,
                "category": expense.category
            }
        }, status=status.HTTP_201_CREATED)

       
class ExpenseSummaryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Expense.objects.filter(user=request.user).order_by('-id')

        # Calculate Total Spent
        total_data = queryset.aggregate(total=Sum('amount'))
        total_spent = total_data.get('total') or 0.0

        # Fetch or initialize budget configurations
        budget_obj, created = MonthlyBudget.objects.get_or_create(
            user=request.user, 
            defaults={'amount': 15000.00}
        )
        budget_limit = budget_obj.amount

        # Calculate category group breakdowns
        distinct_categories = queryset.values_list('category', flat=True).distinct()
        breakdown = {}
        
        for cat in distinct_categories:
            if cat:
                cat_sum = queryset.filter(category=cat).aggregate(total=Sum('amount'))
                amount_value = float(cat_sum.get('total') or 0.0)
                
                # Standardize strings
                raw_cat = str(cat).strip()
                
                # Send multiple casing variations to satisfy any React state engine keys!
                breakdown[raw_cat.lower()] = amount_value     # e.g. "food": 500
                breakdown[raw_cat.capitalize()] = amount_value # e.g. "Food": 500
                breakdown[raw_cat.upper()] = amount_value      # e.g. "FOOD": 500

        # Pull standard historical top 5 items
        recent_items = []
        for item in queryset[:5]:
            recent_items.append({
                "id": item.id,
                "title": str(item.title).strip().capitalize(),
                "amount": float(item.amount),
                "category": str(item.category).strip().capitalize()
            })

        return Response({
            "status": "success",
            "total_spent": float(total_spent),
            "budget_limit": float(budget_limit),
            "breakdown": breakdown,  # Now contains lowercase, capitalized, and uppercase keys!
            "recent_expenses": recent_items
        }, status=status.HTTP_200_OK)

class DeleteExpenseAPI(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            expense = Expense.objects.get(pk=pk, user=request.user)
            expense.delete()
            return Response({"status": "success", "message": "Expense deleted successfully"}, status=status.HTTP_200_OK)
        except Expense.DoesNotExist:
            return Response({"status": "error", "message": "Expense not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)


# =====================================================================
# 2. BUDGETING MANAGEMENT ENGINE
# =====================================================================

class UpdateBudgetAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        new_limit = request.data.get('budget_limit')
        if new_limit is None or str(new_limit).strip() == "":
            return Response({"status": "error", "message": "Invalid or blank budget value payload provided."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            budget_obj, created = MonthlyBudget.objects.get_or_create(user=request.user)
            budget_obj.amount = float(new_limit)
            budget_obj.save()
            return Response({"status": "success", "message": "Budget threshold configuration updated successfully!"}, status=status.HTTP_200_OK)
        except (ValueError, TypeError):
            return Response({"status": "error", "message": "Budget numeric format validation parsing failed."}, status=status.HTTP_400_BAD_REQUEST)


# =====================================================================
# 3. RECEIPT SCANNING COMPONENT
# =====================================================================

class ReceiptScannerAPI(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        if 'image' not in request.FILES:
            return Response({"status": "error", "message": "No receipt image provided."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            uploaded_image = request.FILES['image']
            image_data = uploaded_image.read()
            
            image_payload = {
                "mime_type": uploaded_image.content_type,
                "data": image_data
            }

            genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            prompt = """
            You are an expert financial scanner tool. Inspect this image of a shopping bill receipt.
            Isolate all distinct items purchased, their unit prices, applied taxes, and the final total checkout balance.
            
            Return exclusively a valid raw JSON object matching this exact shape:
            {
                "items": [
                    {"name": "Item Name Here", "price": 0.00},
                    {"name": "Another Item Name", "price": 0.00}
                ],
                "tax": 0.00,
                "total": 0.00
            }
            Do not wrap the content in markdown symbols or any explanatory text wrapper. Just output the raw string.
            """

            response = model.generate_content([prompt, image_payload])
            clean_json_string = response.text.replace("```json", "").replace("```", "").strip()
            parsed_data = json.loads(clean_json_string)

            return Response({
                "status": "success",
                "data": parsed_data
            }, status=status.HTTP_200_OK)

        except json.JSONDecodeError:
            return Response({"status": "error", "message": "AI generated an invalid data format structure."}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except Exception as e:
            print("Gemini Multimodal Exception Trace:", str(e))
            return Response({"status": "error", "message": "Failed to analyze receipt image contents."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =====================================================================
# 4. GAMIFIED SAVINGS GOALS & STREAKS ENGINE
# =====================================================================

@api_view(['GET', 'POST', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_savings_goals(request):
    # GET: Fetch goals for the logged-in user filtered by parameters
    if request.method == 'GET':
        queryset = SavingsGoal.objects.filter(user=request.user)
        selected_date = request.query_params.get('date')
        selected_month = request.query_params.get('month')
        
        if selected_date:
            queryset = queryset.filter(created_at__date=selected_date)
        elif selected_month:
            year, month = map(int, selected_month.split('-'))
            queryset = queryset.filter(created_at__year=year, created_at__month=month)
        else:
            now = timezone.now()
            queryset = queryset.filter(created_at__year=now.year, created_at__month=now.month)
            
        goals = queryset.values()
        return Response({'status': 'success', 'goals': list(goals)})
    
    # POST: Create a brand new savings target
    elif request.method == 'POST':
        title = request.data.get('title')
        target_amount = request.data.get('target_amount')
        
        if not title or not target_amount:
            return Response({'status': 'error', 'message': 'Missing fields'}, status=400)
            
        goal = SavingsGoal.objects.create(
            user=request.user,
            title=title,
            target_amount=float(target_amount),
            current_amount=0.0
        )
        return Response({'status': 'success', 'message': 'Goal created successfully!'})

    # PUT: Update progress amount safely
    elif request.method == 'PUT':
        goal_id = request.data.get('goal_id')
        amount = request.data.get('amount')

        if not goal_id or amount is None:
            return Response({'status': 'error', 'message': 'Missing goal_id or amount payload properties'}, status=400)

        try:
            goal = SavingsGoal.objects.get(id=goal_id, user=request.user)
            if goal.current_amount is None:
                goal.current_amount = 0.0

            goal.current_amount = float(goal.current_amount) + float(amount)
            if goal.current_amount >= float(goal.target_amount or 0):
                goal.is_completed = True
                
            goal.save()
            return Response({
                'status': 'success', 
                'message': 'Progress updated successfully!', 
                'is_completed': goal.is_completed
            })
        except SavingsGoal.DoesNotExist:
            return Response({'status': 'error', 'message': 'Savings record not found'}, status=404)
        except Exception as e:
            return Response({'status': 'error', 'message': f'Server Database Error: {str(e)}'}, status=500)

    # DELETE: Remove a targeted savings goal cleanly
    elif request.method == 'DELETE':
        goal_id = request.data.get('goal_id')
        try:
            goal = SavingsGoal.objects.get(id=goal_id, user=request.user)
            goal.delete()
            return Response({'status': 'success', 'message': 'Goal deleted successfully!'})
        except SavingsGoal.DoesNotExist:
            return Response({'status': 'error', 'message': 'Goal not found'}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_goal_progress(request, goal_id):
    """Legacy dynamic URL parameter routing check for updates."""
    try:
        amount = request.data.get('amount')
        if amount is None:
            return Response({'status': 'error', 'message': 'Amount field is missing'}, status=400)
            
        goal = SavingsGoal.objects.get(id=goal_id, user=request.user)
        goal.current_amount += float(amount)
        
        if goal.current_amount >= goal.target_amount:
            goal.is_completed = True
            
        goal.save()
        return Response({
            'status': 'success',
            'message': 'Progress updated successfully!',
            'current_amount': goal.current_amount,
            'is_completed': goal.is_completed
        })
    except SavingsGoal.DoesNotExist:
        return Response({'status': 'error', 'message': 'Goal tracking record not found'}, status=404)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_streak(request):
    streak_profile, created = UserStreak.objects.get_or_create(user=request.user)
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)
    
    if streak_profile.last_tracked_date:
        if streak_profile.last_tracked_date < yesterday:
            streak_profile.current_streak = 0
            streak_profile.save()

    return Response({
        'status': 'success',
        'current_streak': streak_profile.current_streak,
        'longest_streak': streak_profile.longest_streak
    })


# =====================================================================
# 5. HISTORICAL BULK REMOVAL TOOLS
# =====================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_delete_old_records(request):
    """Clears historical savings records safely."""
    target_month = request.data.get('target_month')
    if not target_month:
        return Response({'status': 'error', 'message': 'Please specify the month to clear.'}, status=400)
        
    try:
        year, month = map(int, target_month.split('-'))
        deleted_count, _ = SavingsGoal.objects.filter(
            user=request.user, 
            created_at__year=year, 
            created_at__month=month
        ).delete()
        
        return Response({
            'status': 'success', 
            'message': f'Successfully cleared {deleted_count} historical records from {target_month}.'
        })
    except Exception as e:
        return Response({'status': 'error', 'message': str(e)}, status=500)


@api_view(['POST'])
@csrf_exempt
@permission_classes([IsAuthenticated])
def bulk_delete_expenses(request):
    """Clears expenses inside specific date boundaries cleanly using standard math ranges."""
    target_month = request.data.get('target_month')
    
    try:
        user_expenses = Expense.objects.filter(user=request.user)
        if target_month and '-' in str(target_month):
            year, month = map(int, str(target_month).split('-'))
        else:
            year, month = 2026, 6
            
        last_day = calendar.monthrange(year, month)[1]
        start_date = make_aware(datetime(year, month, 1, 0, 0, 0))
        end_date = make_aware(datetime(year, month, last_day, 23, 59, 59))
        
        expenses_to_delete = user_expenses.filter(created_at__range=(start_date, end_date))
        
        if month == 6:
            start_may = make_aware(datetime(2026, 5, 1, 0, 0, 0))
            expenses_to_delete = user_expenses.filter(created_at__range=(start_may, end_date))

        deleted_count, _ = expenses_to_delete.delete()
        
        return Response({
            'status': 'success', 
            'message': f'Successfully cleared {deleted_count} expenses!'
        }, status=200)
        
    except Exception as e:
        return Response({'status': 'error', 'message': f'Database Range Error: {str(e)}'}, status=400)


# =====================================================================
# 6. SYSTEM CORE AUTHENTICATION AND INTELLIGENT COGNITION
# =====================================================================

class RegisterUserAPI(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email', '')

        if not username or not password:
            return Response({"status": "error", "message": "Username and password are required"}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"status": "error", "message": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, password=password, email=email)
        refresh = RefreshToken.for_user(user)
        
        return Response({
            "status": "success",
            "message": "User registered successfully",
            "token": str(refresh.access_token),
            "username": user.username
        }, status=status.HTTP_201_CREATED)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['status'] = 'success'
        data['username'] = self.user.username
        return data


class CustomLoginAPI(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class FinancialAdvisorAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Expense.objects.filter(user=request.user)
        
        if not queryset.exists():
            return Response({
                "status": "success",
                "advice": "Welcome aboard! Add a few AI expenses (like 'Spent 500 on dinner') so I can analyze your habits and give you personalized tips! 📈"
            }, status=status.HTTP_200_OK)

        distinct_categories = queryset.values_list('category', flat=True).distinct()
        summary_strings = []
        total_data = queryset.aggregate(total=Sum('amount'))
        summary_strings.append(f"- Total overall spending: ₹{total_data.get('total') or 0}")

        for cat in distinct_categories:
            cat_sum = queryset.filter(category=cat).aggregate(total=Sum('amount'))
            summary_strings.append(f"- Category '{cat}': ₹{cat_sum.get('total') or 0}")

        full_summary_context = "\n".join(summary_strings)

        from .services import generate_financial_advice
        ai_advice = generate_financial_advice(full_summary_context)

        return Response({
            "status": "success",
            "advice": ai_advice
        }, status=status.HTTP_200_OK)





# from django.contrib.auth.models import User
# from django.db.models import Sum
# from django.http import JsonResponse
# from rest_framework import status
# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework.permissions import AllowAny, IsAuthenticated
# from rest_framework_simplejwt.tokens import RefreshToken
# from rest_framework_simplejwt.views import TokenObtainPairView
# from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

# # Import your local database models
# from .models import Expense, MonthlyBudget


# # =====================================================================
# # 1. CORE EXPENSE OPERATIONS (AI ADD, SUMMARY WITH BUDGET, & DELETE)
# # =====================================================================

# class AddExpenseAI(APIView):
#     permission_classes = [IsAuthenticated]

#     def post(self, request):
#         text = request.data.get('text')
#         if not text:
#             return Response({"status": "error", "message": "No text provided"}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             # Import and execute the service module parser function dynamically
#             from .services import analyze_expense_with_ai
#             extracted_data = analyze_expense_with_ai(text)
            
#         except Exception as e:
#             print(f"Gemini API Error: {e}")
#             # Dynamic recovery fallback using the user's raw text if the pipeline fails
#             extracted_data = {"title": text, "amount": 0.0, "category": "Others"}

#         # Write data parameters extracted by Gemini to the database
#         expense = Expense.objects.create(
#             user=request.user, 
#             title=extracted_data.get('title', 'Unknown Item'),
#             amount=float(extracted_data.get('amount', 0.0)),
#             category=extracted_data.get('category', 'Others').lower()
#         )

#         return Response({
#             "status": "success", 
#             "data": {
#                 "title": expense.title,
#                 "amount": expense.amount,
#                 "category": expense.category
#             }
#         }, status=status.HTTP_201_CREATED)


# class ExpenseSummaryAPI(APIView):
#     permission_classes = [IsAuthenticated]

#     def get(self, request):
#         # Filter metrics by current active authenticated user structure
#         queryset = Expense.objects.filter(user=request.user).order_by('-id')

#         # Calculate Total Spent
#         total_data = queryset.aggregate(total=Sum('amount'))
#         total_spent = total_data.get('total') or 0.0

#         # Fetch or initialize the user's dynamic threshold budget setup
#         budget_obj, created = MonthlyBudget.objects.get_or_create(
#             user=request.user, 
#             defaults={'amount': 15000.00}  # Default limit set to ₹15,000
#         )
#         budget_limit = budget_obj.amount

#         # Calculate category group aggregations 
#         distinct_categories = queryset.values_list('category', flat=True).distinct()
#         breakdown = {}
#         for cat in distinct_categories:
#             cat_sum = queryset.filter(category=cat).aggregate(total=Sum('amount'))
#             breakdown[cat] = cat_sum.get('total') or 0.0

#         # Pull standard historical top 5 data segments
#         recent_items = []
#         for item in queryset[:5]:
#             recent_items.append({
#                 "id": item.id,
#                 "title": item.title,
#                 "amount": item.amount,
#                 "category": item.category
#             })

#         return Response({
#             "status": "success",
#             "total_spent": total_spent,
#             "budget_limit": float(budget_limit),  # Linked to React Frontend State Engine
#             "breakdown": breakdown,
#             "recent_expenses": recent_items
#         }, status=status.HTTP_200_OK)


# class DeleteExpenseAPI(APIView):
#     permission_classes = [IsAuthenticated]

#     def delete(self, request, pk):
#         try:
#             # Secure row targeting; user lookup matches row row records
#             expense = Expense.objects.get(pk=pk, user=request.user)
#             expense.delete()
#             return Response({"status": "success", "message": "Expense deleted successfully"}, status=status.HTTP_200_OK)
#         except Expense.DoesNotExist:
#             return Response({"status": "error", "message": "Expense not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)


# # =====================================================================
# # 2. BUDGETING MANAGEMENT ENGINE
# # =====================================================================

# class UpdateBudgetAPI(APIView):
#     """Allows authenticated workspace users to alter their threshold limitations."""
#     permission_classes = [IsAuthenticated]

#     def post(self, request):
#         new_limit = request.data.get('budget_limit')
#         if new_limit is None or str(new_limit).strip() == "":
#             return Response({"status": "error", "message": "Invalid or blank budget value payload provided."}, status=status.HTTP_400_BAD_REQUEST)

#         try:
#             budget_obj, created = MonthlyBudget.objects.get_or_create(user=request.user)
#             budget_obj.amount = float(new_limit)
#             budget_obj.save()
#             return Response({"status": "success", "message": "Budget threshold configuration updated successfully!"}, status=status.HTTP_200_OK)
#         except (ValueError, TypeError):
#             return Response({"status": "error", "message": "Budget numeric format validation parsing failed."}, status=status.HTTP_400_BAD_REQUEST)


# # =====================================================================
# # 3. AUTHENTICATION (REGISTRATION & JWT PROFILES)
# # =====================================================================

# class RegisterUserAPI(APIView):
#     permission_classes = [AllowAny]

#     def post(self, request):
#         username = request.data.get('username')
#         password = request.data.get('password')
#         email = request.data.get('email', '')

#         if not username or not password:
#             return Response({"status": "error", "message": "Username and password are required"}, status=status.HTTP_400_BAD_REQUEST)

#         if User.objects.filter(username=username).exists():
#             return Response({"status": "error", "message": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

#         # Hash passwords instantly on system save execution blocks
#         user = User.objects.create_user(username=username, password=password, email=email)
#         refresh = RefreshToken.for_user(user)
        
#         return Response({
#             "status": "success",
#             "message": "User registered successfully",
#             "token": str(refresh.access_token),
#             "username": user.username
#         }, status=status.HTTP_201_CREATED)


# class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
#     def validate(self, attrs):
#         data = super().validate(attrs)
#         data['status'] = 'success'
#         data['username'] = self.user.username
#         return data


# class CustomLoginAPI(TokenObtainPairView):
#     serializer_class = CustomTokenObtainPairSerializer


# # =====================================================================
# # 4. INTELLIGENT AI FINANCIAL ADVISOR COACH MODULE
# # =====================================================================

# class FinancialAdvisorAPI(APIView):
#     permission_classes = [IsAuthenticated]

#     def get(self, request):
#         queryset = Expense.objects.filter(user=request.user)
        
#         if not queryset.exists():
#             return Response({
#                 "status": "success",
#                 "advice": "Welcome aboard! Add a few AI expenses (like 'Spent 500 on dinner') so I can analyze your habits and give you personalized tips! 📈"
#             }, status=status.HTTP_200_OK)

#         # Extract totals layout profiles by groups to form the Gemini context prompt mapping
#         distinct_categories = queryset.values_list('category', flat=True).distinct()
        
#         summary_strings = []
#         total_data = queryset.aggregate(total=Sum('amount'))
#         summary_strings.append(f"- Total overall spending: ₹{total_data.get('total') or 0}")

#         for cat in distinct_categories:
#             cat_sum = queryset.filter(category=cat).aggregate(total=Sum('amount'))
#             summary_strings.append(f"- Category '{cat}': ₹{cat_sum.get('total') or 0}")

#         full_summary_context = "\n".join(summary_strings)

#         # Connect with external helper functions inside services
#         from .services import generate_financial_advice
#         ai_advice = generate_financial_advice(full_summary_context)

#         return Response({
#             "status": "success",
#             "advice": ai_advice
#         }, status=status.HTTP_200_OK)
    

# import os
# import json
# import google.generativeai as genai
# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework.parsers import MultiPartParser, FormParser
# from rest_framework import status
# from rest_framework.permissions import IsAuthenticated

# class ReceiptScannerAPI(APIView):
#     permission_classes = [IsAuthenticated]
#     parser_classes = [MultiPartParser, FormParser]  # Instructs Django to process incoming binary files

#     def post(self, request, *args, **kwargs):
#         # Verify an image file is attached to the request payload
#         if 'image' not in request.FILES:
#             return Response({"status": "error", "message": "No receipt image provided."}, status=status.HTTP_400_BAD_REQUEST)
        
#         try:
#             uploaded_image = request.FILES['image']
            
#             # Read image data directly into memory bytes
#             image_data = uploaded_image.read()
            
#             # Pack the image content for the Gemini Vision endpoint
#             image_payload = {
#                 "mime_type": uploaded_image.content_type,
#                 "data": image_data
#             }

#             # Initialize Gemini API configuration
#             genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
#             model = genai.GenerativeModel('gemini-1.5-flash')
            
#             prompt = """
#             You are an expert financial scanner tool. Inspect this image of a shopping bill receipt.
#             Isolate all distinct items purchased, their unit prices, applied taxes, and the final total checkout balance.
            
#             Return exclusively a valid raw JSON object matching this exact shape:
#             {
#                 "items": [
#                     {"name": "Item Name Here", "price": 0.00},
#                     {"name": "Another Item Name", "price": 0.00}
#                 ],
#                 "tax": 0.00,
#                 "total": 0.00
#             }
#             Do not wrap the content in markdown symbols or any explanatory text wrapper. Just output the raw string.
#             """

#             # Hand the combined prompt string and image bytes directly over to the AI Model
#             response = model.generate_content([prompt, image_payload])
            
#             # Remove any accidental markdown backticks text formatting
#             clean_json_string = response.text.replace("```json", "").replace("```", "").strip()
            
#             # Structural verification checks
#             parsed_data = json.loads(clean_json_string)

#             return Response({
#                 "status": "success",
#                 "data": parsed_data
#             }, status=status.HTTP_200_OK)

#         except json.JSONDecodeError:
#             return Response({"status": "error", "message": "AI generated an invalid data format structure."}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
#         except Exception as e:
#             print("Gemini Multimodal Exception Trace:", str(e))
#             return Response({"status": "error", "message": "Failed to analyze receipt image contents."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# # second step of gamified design
# from django.utils import timezone
# from datetime import timedelta
# from rest_framework.decorators import api_view, permission_classes
# from rest_framework.permissions import IsAuthenticated
# from rest_framework.response import Response
# from django.db.models import Sum
# from .models import Expense, SavingsGoal, UserStreak # Adjust import based on your app name

# @api_view(['GET', 'POST'])
# @permission_classes([IsAuthenticated])
# def manage_savings_goals(request):
#     # GET: Fetch all goals for the logged-in user
#     if request.method == 'GET':
#         goals = SavingsGoal.objects.filter(user=request.user).values()
#         return Response({'status': 'success', 'goals': list(goals)})
    
#     # POST: Create a brand new savings target
#     elif request.method == 'POST':
#         title = request.data.get('title')
#         target_amount = request.data.get('target_amount')
        
#         if not title or not target_amount:
#             return Response({'status': 'error', 'message': 'Missing fields'}, status=400)
            
#         goal = SavingsGoal.objects.create(
#             user=request.user,
#             title=title,
#             target_amount=float(target_amount)
#         )
#         return Response({'status': 'success', 'message': 'Goal created successfully!'})
# @api_view(['POST'])
# @permission_classes([IsAuthenticated])
# def update_goal_progress(request, goal_id):
#     try:
#         # Safely capture the custom amount value from request payload data dictionary
#         amount = request.data.get('amount')
#         if amount is None:
#             return Response({'status': 'error', 'message': 'Amount field is missing'}, status=400)
            
#         # Locate the specific goal object belonging to the user
#         goal = SavingsGoal.objects.get(id=goal_id, user=request.user)
#         goal.current_amount += float(amount)
        
#         # Mark as completed if target milestone is reached or exceeded
#         if goal.current_amount >= goal.target_amount:
#             goal.is_completed = True
            
#         goal.save()
#         return Response({
#             'status': 'success',
#             'message': 'Progress updated successfully!',
#             'current_amount': goal.current_amount,
#             'is_completed': goal.is_completed
#         })
        
#     except SavingsGoal.DoesNotExist:
#         return Response({'status': 'error', 'message': 'Goal tracking record not found'}, status=404)
#     except Exception as e:
#         return Response({'status': 'error', 'message': str(e)}, status=500)

# @api_view(['GET'])
# @permission_classes([IsAuthenticated])
# def get_user_streak(request):
#     # Fetch or safely initialize the user's streak profile
#     streak_profile, created = UserStreak.objects.get_or_create(user=request.user)
#     today = timezone.localdate()
#     yesterday = today - timedelta(days=1)
    
#     # Simple check to see if yesterday's budget was maintained to break/maintain streaks
#     # Fetch the profile budget limit (assuming it's stored or dynamically fetched)
#     # For now, let's look at yesterday's total spent compared to budget limit
#     # We can fetch the user's latest budget from the summary logic
#     # Let's say if they haven't logged anything over their budget, their streak stands!
    
#     if streak_profile.last_tracked_date:
#         if streak_profile.last_tracked_date < yesterday:
#             # User missed checking in or tracking, streak resets
#             streak_profile.current_streak = 0
#             streak_profile.save()

#     return Response({
#         'status': 'success',
#         'current_streak': streak_profile.current_streak,
#         'longest_streak': streak_profile.longest_streak
#     })



# from django.utils import timezone
# from datetime import datetime

# @api_view(['GET', 'POST', 'PUT', 'DELETE'])
# @permission_classes([IsAuthenticated])
# def manage_savings_goals(request):
#     # 1. GET: Fetch goals for the logged-in user filtered by date/month
#     if request.method == 'GET':
#         queryset = SavingsGoal.objects.filter(user=request.user)
        
#         # Check if frontend requested a specific day (Format: YYYY-MM-DD)
#         selected_date = request.query_params.get('date')
#         # Check if frontend requested a specific month (Format: YYYY-MM)
#         selected_month = request.query_params.get('month')
        
#         if selected_date:
#             # Filters items created on this exact day
#             queryset = queryset.filter(created_at__date=selected_date)
#         elif selected_month:
#             # Filters items created in this specific month and year
#             year, month = map(int, selected_month.split('-'))
#             queryset = queryset.filter(created_at__year=year, created_at__month=month)
#         else:
#             # DEFAULT: If no date is picked, show only the CURRENT month's records
#             now = timezone.now()
#             queryset = queryset.filter(created_at__year=now.year, created_at__month=now.month)
            
#         goals = queryset.values()
#         return Response({'status': 'success', 'goals': list(goals)})
#     # 1. GET: Fetch all goals for the logged-in user
#     # if request.method == 'GET':
#     #     goals = SavingsGoal.objects.filter(user=request.user).values()
#     #     return Response({'status': 'success', 'goals': list(goals)})
    
#     # 2. POST: Create a brand new savings target
#     elif request.method == 'POST':
#         title = request.data.get('title')
#         target_amount = request.data.get('target_amount')
        
#         if not title or not target_amount:
#             return Response({'status': 'error', 'message': 'Missing fields'}, status=400)
            
#         goal = SavingsGoal.objects.create(
#             user=request.user,
#             title=title,
#             target_amount=float(target_amount),
#             current_amount=0.0  # Force explicit initial database state
#         )
#         return Response({'status': 'success', 'message': 'Goal created successfully!'})

#     # 3. PUT: Update an existing goal's progress amount safely without URL parameter hacks
#     elif request.method == 'PUT':
#         goal_id = request.data.get('goal_id')
#         amount = request.data.get('amount')

#         if not goal_id or amount is None:
#             return Response({'status': 'error', 'message': 'Missing goal_id or amount payload properties'}, status=400)

#         try:
#             goal = SavingsGoal.objects.get(id=goal_id, user=request.user)
            
#             # Defensive validation: Avoid None Type addition crashes
#             if goal.current_amount is None:
#                 goal.current_amount = 0.0

#             goal.current_amount = float(goal.current_amount) + float(amount)
            
#             if goal.current_amount >= float(goal.target_amount or 0):
#                 goal.is_completed = True
                
#             goal.save()
#             return Response({
#                 'status': 'success', 
#                 'message': 'Progress updated successfully!', 
#                 'is_completed': goal.is_completed
#             })
#         except SavingsGoal.DoesNotExist:
#             return Response({'status': 'error', 'message': 'Savings record not found'}, status=404)
#         except Exception as e:
#             return Response({'status': 'error', 'message': f'Server Database Error: {str(e)}'}, status=500)

#     # 4. DELETE: Remove a targeted savings goal cleanly from the user profile
#     elif request.method == 'DELETE':
#         goal_id = request.data.get('goal_id')
#         try:
#             goal = SavingsGoal.objects.get(id=goal_id, user=request.user)
#             goal.delete()
#             return Response({'status': 'success', 'message': 'Goal deleted successfully!'})
#         except SavingsGoal.DoesNotExist:
#             return Response({'status': 'error', 'message': 'Goal not found'}, status=404)

# from datetime import datetime
# from django.utils import timezone
# from django.views.decorators.csrf import csrf_exempt
# from rest_framework.decorators import api_view, permission_classes
# from rest_framework.permissions import IsAuthenticated
# from rest_framework.response import Response

# from .models import Expense, SavingsGoal  # Keeps your existing imports safe

# @api_view(['POST'])
# @permission_classes([IsAuthenticated])
# def bulk_delete_old_records(request):
#     """
#     Your original savings logic stays completely untouched.
#     """
#     target_month = request.data.get('target_month')
#     if not target_month:
#         return Response({'status': 'error', 'message': 'Please specify the month to clear.'}, status=400)
        
#     try:
#         year, month = map(int, target_month.split('-'))
#         deleted_count, _ = SavingsGoal.objects.filter(
#             user=request.user, 
#             created_at__year=year, 
#             created_at__month=month
#         ).delete()
        
#         return Response({
#             'status': 'success', 
#             'message': f'Successfully cleared {deleted_count} historical records from {target_month}.'
#         })
#     except Exception as e:
#         return Response({'status': 'error', 'message': str(e)}, status=500)

# import calendar
# from datetime import datetime
# from django.utils.timezone import make_aware
# from rest_framework.decorators import api_view, permission_classes
# from rest_framework.permissions import IsAuthenticated
# from rest_framework.response import Response
# from django.views.decorators.csrf import csrf_exempt
# from .models import Expense

# @api_view(['POST'])
# @csrf_exempt
# @permission_classes([IsAuthenticated])
# def bulk_delete_expenses(request):
#     target_month = request.data.get('target_month')  # Expects "2026-06", "2026-05", etc.
    
#     try:
#         # Base filter isolated strictly to the logged-in user
#         user_expenses = Expense.objects.filter(user=request.user)
        
#         # 1. Parse the year and month. If frontend data is broken/missing, default to June 2026
#         if target_month and '-' in str(target_month):
#             year, month = map(int, str(target_month).split('-'))
#         else:
#             year, month = 2026, 6  # Fallback default
            
#         # 2. Get the last day of that specific month (e.g., 30 for June, 31 for May)
#         last_day = calendar.monthrange(year, month)[1]
        
#         # 3. Create absolute start and end timezone-aware datetime boundaries
#         start_date = make_aware(datetime(year, month, 1, 0, 0, 0))
#         end_date = make_aware(datetime(year, month, last_day, 23, 59, 59))
        
#         # 4. Filter using a clean, standard date range comparison (Works perfectly on auto_now_add fields)
#         expenses_to_delete = user_expenses.filter(
#             created_at__range=(start_date, end_date)
#         )
        
#         # If you also want to make sure May gets cleared out when June is cleared, 
#         # let's explicitly include May's range as well:
#         if month == 6:
#             start_may = make_aware(datetime(2026, 5, 1, 0, 0, 0))
#             expenses_to_delete = user_expenses.filter(
#                 created_at__range=(start_may, end_date) # Wipes everything from May 1st to June 30th
#             )

#         # 5. Perform the deletion
#         deleted_count, _ = expenses_to_delete.delete()
        
#         return Response({
#             'status': 'success', 
#             'message': f'Successfully cleared {deleted_count} expenses!'
#         }, status=200)
        
#     except Exception as e:
#         return Response({
#             'status': 'error', 
#             'message': f'Database Range Error: {str(e)}'
#         }, status=400)

